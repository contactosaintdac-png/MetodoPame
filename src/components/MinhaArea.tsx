import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, getDocs, orderBy, doc, getDoc, updateDoc, addDoc, collectionGroup, where, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { streamGemini } from '../lib/ai';
import { ApplicationScreen, TriageData } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface Booking {
  id: string;
  createdAt: any;
  date: string;
  time?: string;
  assignedEmployeeName?: string;
  assignedEmployeePhoto?: string;
  format: 'meio' | 'completo';
  frequency: 'monthly' | 'avulso';
  totalPrice: number;
  status?: string;
  rating?: number;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'concierge';
  senderName: string;
  text: string;
  time: string;
  createdAt?: any;
}

export default function MinhaArea({ onScreenChange }: { onScreenChange: (screen: ApplicationScreen) => void }) {
  const { user, signOut } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [triageData, setTriageData] = useState<TriageData | null>(null);
  const [loading, setLoading] = useState(true);

  // Tabs Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reservas' | 'indique' | 'historico' | 'suporte'>('dashboard');

  // Calendar state (Minhas Reservas)
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Filters (Histórico & Faturas)
  const [filterPeriod, setFilterPeriod] = useState('3-meses');
  const [filterType, setFilterType] = useState('todos');

  // Chat state (Suporte & Concierge)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [clearChatAt, setClearChatAt] = useState<any>(null);

  const displayMessages = (() => {
    let filtered = chatMessages;
    if (clearChatAt) {
      const clearTime = clearChatAt.toDate ? clearChatAt.toDate().getTime() : 0;
      filtered = chatMessages.filter(m => {
        if (!m.createdAt) return true; // Show pending local writes
        const msgTime = m.createdAt.toDate ? m.createdAt.toDate().getTime() : 0;
        return msgTime > clearTime;
      });
    }

    if (filtered.length === 0) {
      return [
        {
          id: 'welcome-msg',
          sender: 'concierge' as const,
          senderName: 'Atendimento',
          text: `Olá, ${user?.displayName?.split(' ')[0] || 'Cliente'}. Boas-vindas ao canal Concierge do Método Pame. Como podemos ajudar con a sua residência hoje?`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ];
    }
    return filtered;
  })();
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Special Request Form (Suporte & Concierge)
  const [requestType, setRequestType] = useState('Serviços de Catering');
  const [requestDate, setRequestDate] = useState('');
  const [requestDetails, setRequestDetails] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
 
  // Referrals state (Círculo VIP)
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);

  // Accordion state (FAQs)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchBookings = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'bookings'),
          orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
        setBookings(data);
        
        // Default selected booking in calendar to the next upcoming one
        const todayStr = new Date().toISOString().split('T')[0];
        const upcoming = data
          .filter(b => b.date >= todayStr)
          .sort((a, b) => a.date.localeCompare(b.date));
        if (upcoming.length > 0) {
          setSelectedBooking(upcoming[0]);
        } else if (data.length > 0) {
          setSelectedBooking(data[0]);
        }
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
      }
    };

    const fetchTriage = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid, 'profile', 'triage'));
        if (docSnap.exists()) {
          setTriageData(docSnap.data() as TriageData);
        }
      } catch (e) {
        console.error("Error fetching triage:", e);
      }
    };

    Promise.all([fetchBookings(), fetchTriage()]).finally(() => setLoading(false));

    // Listen to root chat doc for clearChatAt
    const chatDocRef = doc(db, 'chats', user.uid);
    const unsubscribeRoot = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setClearChatAt(data.clearChatAt || null);
      }
    });

    // Initialize Real-time Chat
    const chatRef = collection(db, 'chats', user.uid, 'messages');
    const chatQuery = query(chatRef, orderBy('createdAt', 'asc'));
    const unsubscribeMessages = onSnapshot(chatQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          sender: data.role === 'user' ? 'user' : 'concierge',
          senderName: data.role === 'user' ? 'Você' : 'Concierge',
          text: data.text,
          time: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          createdAt: data.createdAt
        } as ChatMessage;
      });
      setChatMessages(msgs);
    });

    return () => {
      unsubscribeRoot();
      unsubscribeMessages();
    };
  }, [user]);
 
  const fetchReferrals = async () => {
    if (!user) return;
    try {
      setReferralsLoading(true);
      const q = query(
        collection(db, 'referrals'),
        where('referrerId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => {
        const data = d.data();
        
        let referralStatus = 'Pendente';
        if (data.status === 'rewarded') {
          referralStatus = 'Usufruído';
        } else if (data.status === 'completed') {
          referralStatus = 'Cortesia Liberada!';
        }
        
        return {
          id: d.id,
          name: data.referredName || 'Amigo Indicado',
          date: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : '—',
          status: referralStatus,
          frequency: 'monthly', // O sistema agora só gera recompensas para planos mensais
          totalPrice: 0 // Não é mais relevante mostrar o preço do plano do amigo por privacidade
        };
      });
      setReferrals(list);
    } catch (err) {
      console.error("Erro ao buscar indicações:", err);
      setReferrals([]);
    } finally {
      setReferralsLoading(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'indique') {
      fetchReferrals();
    }
  }, [user, activeTab]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, isTyping]);

  if (!user) return null;

  // Next booking helper (Dashboard)
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingBookings = bookings
    .filter(b => b.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextBooking = upcomingBookings.length > 0 ? upcomingBookings[0] : null;

  // Star Rating Handler (Histórico)
  const handleRateBooking = async (bookingId: string, rating: number) => {
    try {
      const docRef = doc(db, 'users', user.uid, 'bookings', bookingId);
      await updateDoc(docRef, { rating });
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, rating } : b));
    } catch (e) {
      console.error("Erro ao atualizar avaliação:", e);
    }
  };

  // Chat message send handler
  const handleSendMessage = async () => {
    if (chatInput.trim() === '' || !user) return;
    
    const textToSend = chatInput;
    setChatInput('');
    setIsTyping(true);

    try {
      // 1. Save user message to Firestore
      const messagesRef = collection(db, 'chats', user.uid, 'messages');
      await addDoc(messagesRef, {
        role: 'user',
        text: textToSend,
        createdAt: serverTimestamp()
      });

      // Update root chat doc for Admin Panel
      await setDoc(doc(db, 'chats', user.uid), {
        clientName: user.displayName || 'Cliente',
        clientEmail: user.email || '',
        lastMessageAt: serverTimestamp(),
        lastMessageText: textToSend,
        hasUnreadAdmin: true
      }, { merge: true });

      // 2. Build and clean history for Gemini (strict user/model alternating roles)
      const rawHistory = displayMessages
        .filter(m => m.id !== 'welcome-msg') // exclude hardcoded welcome
        .map(m => ({
          role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
          text: m.text || ''
        }));

      // If the snapshot listener already updated the state with the message we just sent,
      // exclude it from history so we don't send it twice.
      if (rawHistory.length > 0 && 
          rawHistory[rawHistory.length - 1].role === 'user' && 
          rawHistory[rawHistory.length - 1].text === textToSend) {
        rawHistory.pop();
      }

      // Group consecutive messages of the same role (merge their texts) to avoid consecutive role errors.
      const consolidated: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
      for (const msg of rawHistory) {
        if (consolidated.length > 0 && consolidated[consolidated.length - 1].role === msg.role) {
          consolidated[consolidated.length - 1].parts[0].text += "\n" + msg.text;
        } else {
          consolidated.push({
            role: msg.role,
            parts: [{ text: msg.text }]
          });
        }
      }

      // If the consolidated history ends with a 'user' message, we must pop it and prepend its content
      // to the current message we are sending. This ensures that the history passed to startChat
      // never ends with a 'user' message when we are about to call sendMessageStream (which is another 'user' message).
      let finalSendText = textToSend;
      if (consolidated.length > 0 && consolidated[consolidated.length - 1].role === 'user') {
        const lastUserMsg = consolidated.pop();
        if (lastUserMsg) {
          finalSendText = lastUserMsg.parts[0].text + "\n" + textToSend;
        }
      }

      // 3. Request streaming response from Gemini
      const contents = [
        ...consolidated,
        { role: 'user' as const, parts: [{ text: finalSendText }] }
      ];
      const resultStream = streamGemini(contents);
      
      let fullResponse = '';
      for await (const chunk of resultStream) {
        fullResponse += chunk;
        setStreamingMessage(fullResponse);
      }

      // 4. Save AI response to Firestore
      await addDoc(messagesRef, {
        role: 'model',
        text: fullResponse,
        createdAt: serverTimestamp()
      });
      
      setStreamingMessage('');
    } catch (err) {
      console.error("Error sending message to Concierge AI:", err);
      setStreamingMessage("Desculpe, ocorreu um erro de conexão. Por favor, tente novamente.");
    } finally {
      setIsTyping(false);
    }
  };

  // Clear Chat history handler
  const handleClearChat = async () => {
    if (!user) return;
    if (window.confirm("Deseja realmente limpar o histórico do chat? (As mensagens serão ocultadas para você, mas permanecem arquivadas para o suporte)")) {
      try {
        const chatDocRef = doc(db, 'chats', user.uid);
        await setDoc(chatDocRef, {
          clearChatAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error("Erro ao limpar histórico do chat:", e);
      }
    }
  };

  // Special Request Submit Handler
  const handleSpecialRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestDate) return;
    setIsSubmittingRequest(true);
    try {
      const requestsRef = collection(db, 'users', user.uid, 'concierge_requests');
      await addDoc(requestsRef, {
        type: requestType,
        date: requestDate,
        details: requestDetails,
        status: 'Pendente',
        createdAt: new Date().toISOString()
      });
      setShowSuccessModal(true);
      setRequestDate('');
      setRequestDetails('');
    } catch (e) {
      console.error("Erro ao enviar solicitação de concierge:", e);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Dynamic Calendar Calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0, Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDaysInMonth = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const navItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: 'dashboard' },
    { id: 'reservas', label: 'Minhas Reservas', icon: 'calendar_today' },
    { id: 'indique', label: 'Círculo VIP', icon: 'stars' },
    { id: 'historico', label: 'Histórico & Faturas', icon: 'receipt_long' },
    { id: 'suporte', label: 'Suporte & Concierge', icon: 'support_agent' }
  ] as const;

  const faqs = [
    {
      q: 'O que inclui o Protocolo Residencial Silk & Stone?',
      a: 'Nosso protocolo de alto padrão utiliza tecnologia de purificação de ar, agentes de limpeza biodegradáveis de alta performance sem fragrâncias sintéticas agressivas, e aspiração profunda. Inclui tratamento de superfícies nobres como mármores, madeiras enceradas e metais polidos.'
    },
    {
      q: 'Como é garantida a privacidade e segurança na minha residência?',
      a: 'Todas as especialistas passam por rigorosa auditoria de referências anteriores e assinam termos estritos de confidencialidade. A entrada e saída são monitoradas pela coordenação e você receberá atualizações em tempo real.'
    },
    {
      q: 'Política de cancelamento e reagendamento de serviços',
      a: 'Os reagendamentos e cancelamentos de sessões agendadas podem ser solicitados gratuitamente através do canal Concierge ou chat até 24 horas antes do horário programado.'
    }
  ];

  return (
    <div className="flex w-full min-h-screen bg-[#fff7fd] text-[#1e1a20] font-sans overflow-x-hidden relative">
      
      {/* ── Sidebar Navigation ── */}
      <aside className="hidden lg:flex h-screen w-72 flex-col fixed left-0 top-0 bg-[#fff7fd] border-r border-[#efe5ee] z-50 p-6 gap-6 justify-between shadow-sm">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5 ml-2 cursor-pointer" onClick={() => onScreenChange('welcome')}>
            <h1 className="font-display italic text-2xl font-semibold text-[#561668] tracking-tight flex items-center gap-2">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn" alt="" className="w-7 h-7 rounded-full object-cover" />
              Método Pame
            </h1>
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#80737f]">Gestão de Residências</p>
          </div>

          <nav className="flex flex-col gap-2.5 mt-4">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3.5 p-3.5 rounded-2xl transition-all duration-300 text-left font-bold text-sm tracking-wide cursor-pointer active-scale ${
                    isActive
                      ? 'bg-[#561668] text-white shadow-md silk-text-glow'
                      : 'text-[#4e434e] hover:bg-[#faf1fa] hover:text-[#561668]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => onScreenChange('triage')}
            className="w-full py-3.5 bg-[#561668] text-white font-bold rounded-2xl shadow-lg hover:bg-[#703081] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Nova Reserva
          </button>

          <button
            onClick={() => onScreenChange('welcome')}
            className="w-full py-3 bg-[#f4ebf4] text-[#561668] font-bold rounded-2xl text-xs uppercase tracking-wider hover:bg-[#efe5ee] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">home</span>
            Voltar ao Site
          </button>

          <div className="flex items-center gap-3 p-3 bg-[#faf1fa] rounded-2xl border border-[#efe5ee]">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-white/80 shadow-sm object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#561668] text-white flex items-center justify-center text-md font-bold shadow-sm">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden flex-1">
              <p className="font-bold text-xs text-[#561668] truncate">{user.displayName || 'Cliente'}</p>
              <p className="text-[9px] text-[#80737f] font-semibold uppercase tracking-wider">Membro Premium</p>
            </div>
            <button
              onClick={async () => {
                await signOut();
                onScreenChange('welcome');
              }}
              className="w-8 h-8 rounded-xl bg-[#fff7fd] hover:bg-[#efe5ee] text-[#561668] flex items-center justify-center cursor-pointer shadow-sm border border-[#efe5ee]/40"
              title="Sair da conta"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Canvas ── */}
      <main className="flex-1 lg:ml-72 min-h-screen relative flex flex-col pb-12">
        
        {/* Mobile Header / Navigation */}
        <header className="lg:hidden w-full bg-[#fff7fd]/90 backdrop-blur-md border-b border-[#efe5ee] flex justify-between items-center px-6 py-4 h-[72px] sticky top-0 z-40">
          <h2 className="font-sans text-xl font-extrabold text-[#561668] tracking-tight flex items-center gap-2">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn" alt="" className="w-6 h-6 rounded-full object-cover" />
            Portal Pame
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onScreenChange('triage')}
              className="w-10 h-10 rounded-full bg-[#561668] text-white flex items-center justify-center shadow-sm cursor-pointer"
              title="Nova Reserva"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
            <button
              onClick={async () => {
                await signOut();
                onScreenChange('welcome');
              }}
              className="w-10 h-10 rounded-full bg-[#faf1fa] text-[#561668] border border-[#efe5ee] flex items-center justify-center cursor-pointer"
              title="Sair"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </header>

        {/* Mobile Sub-Tab Navigation Bar */}
        <div className="lg:hidden flex bg-[#faf1fa] border-b border-[#efe5ee] p-1.5 overflow-x-auto gap-1 sticky top-[72px] z-30">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === item.id
                  ? 'bg-[#561668] text-white shadow-sm'
                  : 'text-[#4e434e] hover:bg-[#efe5ee]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
              <span>{item.label.split(' ')[0]}</span>
            </button>
          ))}
          <button
            onClick={() => onScreenChange('welcome')}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#561668] bg-[#f4ebf4]"
          >
            <span className="material-symbols-outlined text-[16px]">home</span>
            <span>Site</span>
          </button>
        </div>

        {/* ── Content Area ── */}
        <div className="p-6 md:p-8 max-w-5xl w-full mx-auto flex-1 flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col gap-6 min-h-[450px] animate-pulse-silk">
              {/* Header Skeleton */}
              <div className="flex flex-col gap-2.5">
                <div className="h-4 w-32 bg-[#561668]/10 rounded-lg"></div>
                <div className="h-8 w-64 bg-[#561668]/15 rounded-xl"></div>
              </div>
              
              {/* Cards Grid Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="silk-lift rounded-3xl p-6 h-36 flex flex-col justify-between">
                  <div className="h-10 w-10 bg-[#faf1fa] rounded-full"></div>
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-16 bg-[#efe5ee] rounded"></div>
                    <div className="h-4 w-36 bg-[#efe5ee] rounded"></div>
                  </div>
                </div>
                <div className="silk-lift rounded-3xl p-6 h-36 flex flex-col justify-between">
                  <div className="h-10 w-10 bg-[#faf1fa] rounded-full"></div>
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-16 bg-[#efe5ee] rounded"></div>
                    <div className="h-4 w-36 bg-[#efe5ee] rounded"></div>
                  </div>
                </div>
                <div className="silk-lift rounded-3xl p-6 h-36 flex flex-col justify-between">
                  <div className="h-10 w-10 bg-[#faf1fa] rounded-full"></div>
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-16 bg-[#efe5ee] rounded"></div>
                    <div className="h-4 w-36 bg-[#efe5ee] rounded"></div>
                  </div>
                </div>
              </div>

              {/* Table/List Skeleton */}
              <div className="silk-lift rounded-3xl p-6 flex-1 flex flex-col gap-4 min-h-[160px]">
                <div className="h-4 w-40 bg-[#efe5ee] rounded-lg"></div>
                <div className="flex flex-col gap-3.5 mt-2">
                  <div className="h-12 w-full bg-[#faf1fa] rounded-xl"></div>
                  <div className="h-12 w-full bg-[#faf1fa]/70 rounded-xl"></div>
                </div>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              
              {/* ── TAB 1: DASHBOARD (PAINEL GERAL) ── */}
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-8 w-full"
                >
                  {/* Hero Greeting */}
                  <div>
                    <h2 className="font-display italic text-3xl md:text-4xl font-semibold text-[#561668] tracking-tight">
                      Boas-vindas, {user.displayName?.split(' ')[0] || 'Cliente'}
                    </h2>
                    <p className="text-[#4e434e] mt-1 text-sm md:text-base">
                      Confira o resumo de agendamentos e protocolos de luxo ativos em sua residência.
                    </p>
                  </div>

                  {/* Bento Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Next Appointment Card (Bento Big) */}
                    <div className="md:col-span-2 silk-lift p-6 md:p-8 flex flex-col justify-between min-h-[280px] relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                        <span className="material-symbols-outlined text-[120px] text-[#561668]">event_upcoming</span>
                      </div>

                      <div className="relative z-10">
                        <span className="px-3 py-1 bg-[#f4ebf4] text-[#561668] font-bold text-[10px] uppercase tracking-widest rounded-full shadow-inner">
                          Próximo Atendimento
                        </span>

                        {nextBooking ? (
                          <>
                            <h4 className="font-sans text-2xl font-extrabold text-[#561668] mt-5 mb-1">
                              Método Pame Residencial
                            </h4>
                            <p className="text-xs text-[#4e434e] font-semibold flex items-center gap-1.5 mt-2 opacity-85">
                              <span className="material-symbols-outlined text-[16px] text-[#561668]">location_on</span>
                              {triageData ? `${triageData.rooms} Quartos • ${triageData.baths} Banheiros • SC` : 'Residência Cadastrada, SC'}
                            </p>
                          </>
                        ) : (
                          <div className="mt-8 text-center py-4">
                            <p className="text-sm text-[#4e434e] mb-4 font-medium">Sua residência não possui agendamentos ativos.</p>
                            <button
                              onClick={() => onScreenChange('triage')}
                              className="px-6 py-2.5 bg-[#561668] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#703081] active:scale-95 transition-all cursor-pointer shadow-md"
                            >
                              Solicitar Avaliação
                            </button>
                          </div>
                        )}
                      </div>

                      {nextBooking && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8 pt-4 border-t border-[#efe5ee]/60 relative z-10">
                          <div className="bg-[#faf1fa]/80 p-3 rounded-xl border border-[#efe5ee]/40 text-center">
                            <p className="text-[9px] text-[#80737f] uppercase font-bold tracking-wider mb-0.5">Data</p>
                            <p className="font-bold text-sm text-[#561668]">
                              {new Date(nextBooking.date + "T12:00:00").toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </p>
                            <p className="text-[10px] text-[#4e434e] font-semibold">{nextBooking.time || '09:00'}</p>
                          </div>

                          <div className="bg-[#faf1fa]/80 p-3 rounded-xl border border-[#efe5ee]/40 text-center">
                            <p className="text-[9px] text-[#80737f] uppercase font-bold tracking-wider mb-0.5">Especialista</p>
                            <p className="font-bold text-sm text-[#561668] truncate">
                              {nextBooking.assignedEmployeeName ? nextBooking.assignedEmployeeName.split(' ')[0] : 'Alocando...'}
                            </p>
                            <p className="text-[10px] text-[#80737f] font-semibold">Técnica</p>
                          </div>

                          <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                            <button
                              onClick={() => setActiveTab('reservas')}
                              className="w-full py-2.5 silk-lift hover:silk-active text-xs text-[#561668] font-bold rounded-xl active:scale-95 transition-all border border-[#efe5ee]/60 cursor-pointer"
                            >
                              Ver Detalhes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Member Status Card */}
                    <div className="silk-lift p-6 flex flex-col justify-between min-h-[280px]">
                      <div>
                        <span className="px-3 py-1 bg-[#f4ebf4] text-[#561668] font-bold text-[10px] uppercase tracking-widest rounded-full shadow-inner">
                          Sua Assinatura
                        </span>
                        <div className="mt-6 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-[#faf1fa] border border-[#efe5ee] flex items-center justify-center text-[#561668]">
                            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                          </div>
                          <div>
                            <p className="font-sans text-xl font-extrabold text-[#561668]">Premium Club</p>
                            <p className="text-[10px] text-[#80737f] font-bold uppercase tracking-wider mt-0.5">Residencial Exclusivo</p>
                          </div>
                        </div>
                        
                        <div className="mt-6 text-xs text-[#4e434e] space-y-2 font-medium">
                          <p className="flex justify-between">
                            <span className="text-[#80737f]">Frequência:</span>
                            <span className="font-bold">{nextBooking?.frequency === 'monthly' ? 'Pacote Mensal' : 'Serviços Avulsos'}</span>
                          </p>
                          {triageData && (
                            <p className="flex justify-between">
                              <span className="text-[#80737f]">Métricas da Residência:</span>
                              <span className="font-bold">{triageData.rooms}Q • {triageData.baths}B</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => onScreenChange('pricing')}
                        className="w-full py-2.5 bg-[#f4ebf4] hover:bg-[#efe5ee] text-[#561668] font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        Matriz de Investimento
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </div>

                    {/* Invoices List (Bento Box) */}
                    <div className="silk-lift p-6 flex flex-col">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#efe5ee]/40">
                        <h4 className="font-sans text-md font-bold text-[#561668]">Faturas Recentes</h4>
                        <button onClick={() => setActiveTab('historico')} className="text-[10px] text-[#561668] font-extrabold uppercase tracking-wider hover:underline">
                          Ver todas
                        </button>
                      </div>

                      {bookings.length > 0 ? (
                        <div className="flex flex-col gap-2.5 flex-1 justify-center">
                          {bookings.slice(0, 2).map((b) => (
                            <div key={b.id} className="flex justify-between items-center p-3 silk-inset rounded-xl">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#561668] text-[20px]">description</span>
                                <div className="text-left leading-tight">
                                  <p className="font-bold text-xs text-[#561668]">FAT-{b.id.slice(0, 4).toUpperCase()}</p>
                                  <p className="text-[9px] text-[#80737f] font-semibold">{new Date(b.date + "T12:00:00").toLocaleDateString('pt-BR')}</p>
                                </div>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <p className="font-bold text-xs text-[#561668]">R$ {b.totalPrice}</p>
                                <span className="material-symbols-outlined text-[#80737f] text-[16px] hover:text-[#561668] cursor-pointer">download</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#80737f] text-center my-auto italic">Nenhuma fatura disponível.</p>
                      )}
                    </div>

                    {/* Recommended Services (Bento Big) */}
                    <div className="md:col-span-2 silk-lift p-6">
                      <h4 className="font-sans text-md font-bold text-[#561668] mb-4 pb-2 border-b border-[#efe5ee]/40">
                        Recomendado para Você
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="group cursor-pointer bg-[#faf1fa]/50 p-3 rounded-xl border border-[#efe5ee]/40 hover:bg-[#fff] hover:shadow-md transition-all duration-300">
                          <div className="h-28 rounded-lg overflow-hidden relative shadow-inner mb-3">
                            <img
                              alt="Mindfulness"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9wQorRZ7fEW9Qo5SCuUHrLvb0u3CfMMDx5oLFmDSfZNSn3yERUMwRMCWfxp_91EUvXK0IO80H7WbEB53VQAK8_jmr02K5Ssk-pZixwuYdizG601uTkBWF4uxxqqGosJVE05O4ACqWm7JorCWgWHrJaXBZpHumUGpgexDy0ZGn83IT8XxUJZjt7tYYerkZdw3HylC1AZRL46YQ9-F70yPE0jLA8oLWQDgdLY4mgrfl2vFKb4Jc4YbHw9WgBMbYUjaTuIMm0fbGxiem"
                            />
                            <div className="absolute top-2 right-2">
                              <span className="bg-[#561668] text-white text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Premium</span>
                            </div>
                          </div>
                          <h6 className="font-bold text-xs text-[#561668]">Protocolo Aromaterapia Lavanda</h6>
                          <p className="text-[10px] text-[#80737f] mt-0.5 line-clamp-1">Purificação e óleos essenciais calmantes em toda a residência.</p>
                          <p className="mt-2 text-xs font-bold text-[#561668]">Adicional sob consulta</p>
                        </div>

                        <div className="group cursor-pointer bg-[#faf1fa]/50 p-3 rounded-xl border border-[#efe5ee]/40 hover:bg-[#fff] hover:shadow-md transition-all duration-300">
                          <div className="h-28 rounded-lg overflow-hidden relative shadow-inner mb-3">
                            <img
                              alt="Ritual Piel de Seda"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB8tqs5wlAyV9c98imi08HTd6TWe8bvMClbzuhQQAzDbCdCrzkhEj5_vdjMfk9cdaZ2tFck17LBG0C7XUsX8HrNQ1TaGjL_GHk5N-JZSrxYFu-ctyPVWt2Xkm9YSqsEiO293iriZwKI5XU9Wn_8Z3I7GxOAZ40viU8ueCJd4x92j1sBFaqARmKASBY1Q-1gJVp14P7WPQgwOIPE9606K42TuAx7XWvTfjKLZ8is9ZxGjLnhxEw9Hjeo8mjHzDm0PxQzmeusFLf7m4Go"
                            />
                          </div>
                          <h6 className="font-bold text-xs text-[#561668]">Tratamento de Mármores Nobres</h6>
                          <p className="text-[10px] text-[#80737f] mt-0.5 line-clamp-1">Polimento especializado e selagem de pedras importadas.</p>
                          <p className="mt-2 text-xs font-bold text-[#561668]">Incluso na Triage Especial</p>
                        </div>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}

              {/* ── TAB 2: MINHAS RESERVAS (CALENDÁRIO) ── */}
              {activeTab === 'reservas' && (
                <motion.div
                  key="reservas-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-6 w-full"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="font-display italic text-3xl font-semibold text-[#561668] tracking-tight">
                        Calendário Mensal
                      </h2>
                      <p className="text-xs text-[#80737f] font-semibold mt-1">
                        Sua agenda residencial e detalhes do atendimento do dia selecionado.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 bg-[#faf1fa] p-1.5 rounded-xl border border-[#efe5ee]/60">
                      <button
                        onClick={handlePrevMonth}
                        className="w-8 h-8 rounded-lg hover:bg-white text-[#561668] flex items-center justify-center cursor-pointer shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                      </button>
                      <span className="text-xs font-bold text-[#561668] min-w-[90px] text-center">
                        {monthNames[month]} {year}
                      </span>
                      <button
                        onClick={handleNextMonth}
                        className="w-8 h-8 rounded-lg hover:bg-white text-[#561668] flex items-center justify-center cursor-pointer shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Calendar Grid (8 Cols) */}
                    <div className="lg:col-span-7 silk-lift p-4 md:p-6 rounded-3xl">
                      
                      {/* Week headers */}
                      <div className="grid grid-cols-7 border-b border-[#efe5ee]/40 pb-3 mb-3 text-center text-[10px] font-bold text-[#80737f] tracking-wider">
                        <div>SEG</div>
                        <div>TER</div>
                        <div>QUA</div>
                        <div>QUI</div>
                        <div>SEX</div>
                        <div className="text-[#703081]">SÁB</div>
                        <div className="text-[#703081]">DOM</div>
                      </div>

                      {/* Day cells */}
                      <div className="grid grid-cols-7 gap-2">
                        {/* Prev Month Placeholders */}
                        {Array.from({ length: firstDayIndex }).map((_, i) => {
                          const dayNum = prevDaysInMonth - firstDayIndex + 1 + i;
                          return (
                            <div key={`prev-${i}`} className="h-16 rounded-xl flex items-start p-1.5 opacity-20 text-[11px] font-semibold">
                              {dayNum}
                            </div>
                          );
                        })}

                        {/* Current Month Days */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const dayBookings = bookings.filter(b => b.date === dayStr);
                          const isSelected = selectedBooking?.date === dayStr;

                          return (
                            <button
                              key={`day-${day}`}
                              onClick={() => {
                                if (dayBookings.length > 0) {
                                  setSelectedBooking(dayBookings[0]);
                                } else {
                                  setSelectedBooking(null);
                                }
                              }}
                              className={`h-16 rounded-xl flex flex-col justify-between p-1.5 text-left text-[11px] font-bold transition-all relative ${
                                isSelected
                                  ? 'bg-[#561668] text-white shadow-md'
                                  : dayBookings.length > 0
                                  ? 'bg-[#f4ebf4] text-[#561668] border border-[#561668]/15 hover:bg-[#efe5ee]'
                                  : 'bg-[#faf1fa]/40 hover:bg-[#faf1fa] border border-transparent'
                              }`}
                            >
                              <span>{day}</span>
                              {dayBookings.length > 0 && (
                                <div className="w-full flex items-center justify-between mt-auto">
                                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[#561668]'}`}></span>
                                  <span className={`text-[8px] uppercase tracking-wider truncate font-extrabold max-w-[80%] ${isSelected ? 'text-white/80' : 'text-[#561668]/80'}`}>
                                    {dayBookings[0].format === 'meio' ? 'Meio' : 'Integral'}
                                  </span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Details Card (5 Cols) */}
                    <div className="lg:col-span-5">
                      {selectedBooking ? (
                        <div className="silk-lift p-6 flex flex-col gap-5">
                          <div className="flex items-center gap-3 pb-3 border-b border-[#efe5ee]/40">
                            <div className="w-10 h-10 rounded-xl bg-[#faf1fa] border border-[#efe5ee] flex items-center justify-center text-[#561668] shadow-sm">
                              <span className="material-symbols-outlined text-[24px]">cleaning_services</span>
                            </div>
                            <div>
                              <h4 className="font-sans text-md font-bold text-[#561668]">Atendimento Pame</h4>
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[8px] font-extrabold rounded-full uppercase tracking-wider">
                                {selectedBooking.status || 'Confirmado'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3.5 text-left text-xs font-semibold text-[#4e434e]">
                            <div className="flex items-start gap-3">
                              <span className="material-symbols-outlined text-[#80737f] text-[18px]">schedule</span>
                              <div>
                                <p className="text-[8px] text-[#80737f] uppercase font-bold tracking-wider">Data e Turno</p>
                                <p className="text-[#561668] mt-0.5 font-bold">
                                  {new Date(selectedBooking.date + "T12:00:00").toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                </p>
                                <p className="text-[#80737f] mt-0.5">{selectedBooking.time || '09:00'} ({selectedBooking.format === 'meio' ? '4 Horas' : '9 Horas'})</p>
                              </div>
                            </div>

                            {triageData && (
                              <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-[#80737f] text-[18px]">location_on</span>
                                <div>
                                  <p className="text-[8px] text-[#80737f] uppercase font-bold tracking-wider">Superfície & Triagem</p>
                                  <p className="text-[#561668] mt-0.5 font-bold">Residência Cadastrada</p>
                                  <p className="text-[#80737f] mt-0.5">
                                    {triageData.rooms} Quartos • {triageData.baths} Banheiros • {triageData.floors} Pavimentos
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="flex items-start gap-3">
                              <span className="material-symbols-outlined text-[#80737f] text-[18px]">person_celebrate</span>
                              <div>
                                <p className="text-[8px] text-[#80737f] uppercase font-bold tracking-wider">Especialista Atribuída</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  {selectedBooking.assignedEmployeePhoto ? (
                                    <img src={selectedBooking.assignedEmployeePhoto} alt="Especialista" className="w-8 h-8 rounded-full border shadow-sm object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-[#f4ebf4] flex items-center justify-center text-[#561668]">
                                      <span className="material-symbols-outlined text-[16px]">person</span>
                                    </div>
                                  )}
                                  <span className="text-[#561668] font-bold">{selectedBooking.assignedEmployeeName || 'Alocando Especialista...'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-[#efe5ee]/40">
                              <p className="text-[8px] text-[#80737f] uppercase font-bold tracking-wider mb-2">Protocolos Premium Inclusos</p>
                              <div className="flex flex-wrap gap-1.5">
                                <span className="px-2.5 py-1 bg-[#faf1fa] border border-[#efe5ee]/60 rounded-lg text-[9px] text-[#561668] flex items-center gap-1 font-bold">
                                  <span className="material-symbols-outlined text-[12px]">sanitizer</span> Desinfecção UV
                                </span>
                                <span className="px-2.5 py-1 bg-[#faf1fa] border border-[#efe5ee]/60 rounded-lg text-[9px] text-[#561668] flex items-center gap-1 font-bold">
                                  <span className="material-symbols-outlined text-[12px]">eco</span> Eco-Luxe
                                </span>
                                <span className="px-2.5 py-1 bg-[#faf1fa] border border-[#efe5ee]/60 rounded-lg text-[9px] text-[#561668] flex items-center gap-1 font-bold">
                                  <span className="material-symbols-outlined text-[12px]">check_circle</span> Silencioso
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2.5 mt-4 pt-3 border-t border-[#efe5ee]/30">
                            <button
                              onClick={() => {
                                setChatInput(`Olá, preciso reagendar meu atendimento agendado para o dia ${new Date(selectedBooking.date + "T12:00:00").toLocaleDateString('pt-BR')}.`);
                                setActiveTab('suporte');
                              }}
                              className="flex-1 py-2.5 bg-[#f4ebf4] hover:bg-[#efe5ee] text-[#561668] font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border border-[#efe5ee]/30"
                            >
                              Reagendar
                            </button>
                            <button
                              onClick={() => {
                                setChatInput(`Olá, gostaria de solicitar o cancelamento do meu atendimento do dia ${new Date(selectedBooking.date + "T12:00:00").toLocaleDateString('pt-BR')}.`);
                                setActiveTab('suporte');
                              }}
                              className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="silk-inset p-8 rounded-3xl text-center min-h-[300px] flex flex-col justify-center items-center gap-4">
                          <span className="material-symbols-outlined text-[48px] text-[#80737f] opacity-60">calendar_today</span>
                          <div>
                            <p className="font-sans text-md font-bold text-[#561668]">Nenhum Serviço Programado</p>
                            <p className="text-xs text-[#80737f] mt-1">Selecione um dia destacado no calendário ou solicite uma nova data residencial.</p>
                          </div>
                          <button
                            onClick={() => onScreenChange('triage')}
                            className="mt-4 px-6 py-2.5 bg-[#561668] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#703081] transition-all shadow-md cursor-pointer"
                          >
                            Nova Reserva
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </motion.div>
              )}

              {/* ── TAB: CÍRCULO VIP (INDIQUE E GANHE) ── */}
              {activeTab === 'indique' && (
                <motion.div
                  key="indique-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-6 w-full"
                >
                  <div>
                    <h2 className="font-display italic text-3xl font-semibold text-[#561668] tracking-tight">
                      Círculo de Excelência
                    </h2>
                    <p className="text-xs text-[#80737f] font-semibold mt-1">
                      Estenda o cuidado que você confia para os lares das pessoas que estima.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Share Card Column (5 Cols) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                      
                      {/* Reward Info Box */}
                      <div className="rounded-3xl p-6 text-white relative overflow-hidden" style={{ background: '#561668' }}>
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <span className="material-symbols-outlined text-[80px]">stars</span>
                        </div>
                        <h3 className="text-lg font-bold mb-3 relative z-10">Recompensa VIP Gana-Gana</h3>
                        <p className="text-xs opacity-90 leading-relaxed mb-4 relative z-10">
                          Indique o Método Pame para seus amigos. Quando algum deles contratar o **Pacote Mensal**:
                        </p>
                        <ul className="flex flex-col gap-2.5 text-xs font-semibold relative z-10">
                          <li className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm bg-white/20 p-1 rounded-full">check</span>
                            Você ganha: 1 Faxina Completa Full Detail Grátis
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm bg-white/20 p-1 rounded-full">check</span>
                            Seu amigo ganha: R$ 100 de desconto no primeiro mês
                          </li>
                        </ul>
                      </div>

                      {/* Copy Link & Share */}
                      <div className="silk-lift rounded-3xl p-6 flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-[#561668]">Compartilhar Convite VIP</h3>
                        
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-[#80737f] uppercase tracking-wider">Seu Link de Indicação</label>
                          <div className="flex gap-2 bg-[#faf1fa] p-1.5 rounded-xl border border-[#efe5ee]/60">
                            <input
                              type="text"
                              readOnly
                              value={`https://www.metodopame.com/?ref=${user?.uid}`}
                              className="bg-transparent border-none outline-none text-xs flex-1 px-2 select-all font-semibold text-[#561668]"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`https://www.metodopame.com/?ref=${user?.uid}`);
                                const btn = document.getElementById('copyRefBtn');
                                if (btn) {
                                  btn.innerText = 'Copiado!';
                                  setTimeout(() => btn.innerText = 'Copiar', 2000);
                                }
                              }}
                              id="copyRefBtn"
                              className="px-4 py-2 bg-white text-[#561668] border border-[#efe5ee]/80 font-bold rounded-lg text-[10px] uppercase tracking-wider cursor-pointer transition-all hover:bg-[#faf1fa] shadow-sm"
                            >
                              Copiar
                            </button>
                          </div>
                        </div>

                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `Olá! Estou usando o Método Pame para cuidados residenciais de alto padrão e recomendo muito. Eles criaram o Círculo de Excelência: se você contratar um Pacote Mensal através do meu link, você ganha R$ 100 de desconto na primeira mensalidade e eu ganho uma faxina de presente! Aqui está o meu convite VIP: https://www.metodopame.com/?ref=${user?.uid}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 bg-[#25d366] text-white font-bold rounded-xl text-xs uppercase tracking-widest text-center flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md"
                        >
                          <span className="material-symbols-outlined text-[18px]">share</span>
                          Indicar via WhatsApp
                        </a>
                      </div>
                    </div>

                    {/* Referrals List Column (7 Cols) */}
                    <div className="lg:col-span-7 silk-lift rounded-3xl p-6">
                      <h3 className="text-sm font-bold text-[#561668] mb-4">Minhas Indicações</h3>

                      {referralsLoading ? (
                        <div className="flex flex-col gap-3 py-4 animate-pulse-silk">
                          <div className="h-9 w-full bg-[#faf1fa] rounded-lg"></div>
                          <div className="h-9 w-full bg-[#faf1fa]/75 rounded-lg"></div>
                          <div className="h-9 w-full bg-[#faf1fa]/50 rounded-lg"></div>
                        </div>
                      ) : referrals.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center gap-3">
                          <span className="material-symbols-outlined text-4xl text-[#d1c2d0]">group_add</span>
                          <p className="text-xs text-[#80737f]">Nenhuma indicação realizada ainda.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#efe5ee]/40 text-[#80737f] uppercase font-bold tracking-wider text-[10px]">
                                <th className="pb-3 text-left">Amigo Indicado</th>
                                <th className="pb-3 text-center">Data</th>
                                <th className="pb-3 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {referrals.map((ref) => {
                                const statusColors = 
                                  ref.status === 'Cortesia Liberada!' ? 'bg-green-50 text-green-700' :
                                  ref.status === 'Usufruído' ? 'bg-[#561668]/15 text-[#561668]' :
                                  'bg-yellow-50 text-yellow-700';
                                
                                return (
                                  <tr key={ref.id} className="border-b border-[#efe5ee]/20 last:border-none hover:bg-[#faf1fa]/25 transition-colors">
                                    <td className="py-3.5 text-left font-bold text-[#1e1a20]">
                                      {ref.name}
                                    </td>
                                    <td className="py-3.5 text-center text-[#80737f] font-semibold">
                                      {ref.date}
                                    </td>
                                    <td className="py-3.5 text-right font-bold">
                                      <span className={`px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider font-extrabold ${statusColors}`}>
                                        {ref.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB 3: HISTÓRICO & FATURAS ── */}
              {activeTab === 'historico' && (
                <motion.div
                  key="historico-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-6 w-full"
                >
                  <div>
                    <h2 className="font-display italic text-3xl font-semibold text-[#561668] tracking-tight">
                      Histórico &amp; Faturamento
                    </h2>
                    <p className="text-xs text-[#80737f] font-semibold mt-1">
                      Acesse os atendimentos anteriores, avalie os resultados e faça o download dos comprovantes.
                    </p>
                  </div>

                  {/* Filters Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="silk-lift p-4 rounded-2xl flex items-center justify-between gap-4 md:col-span-2">
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[9px] font-bold text-[#80737f] uppercase tracking-wider ml-1">Período</label>
                        <select
                          value={filterPeriod}
                          onChange={(e) => setFilterPeriod(e.target.value)}
                          className="bg-transparent border-none font-bold text-xs text-[#561668] focus:ring-0 cursor-pointer min-w-[140px]"
                        >
                          <option value="3-meses">Últimos 3 meses</option>
                          <option value="este-ano">Este ano</option>
                          <option value="todos">Todo o Histórico</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[9px] font-bold text-[#80737f] uppercase tracking-wider ml-1">Atendimento</label>
                        <div className="flex gap-1 mt-0.5">
                          <button
                            onClick={() => setFilterType('todos')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                              filterType === 'todos' ? 'bg-[#561668] text-white shadow-sm' : 'bg-white hover:bg-[#faf1fa] text-[#4e434e]'
                            }`}
                          >
                            Todos
                          </button>
                          <button
                            onClick={() => setFilterType('mensal')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                              filterType === 'mensal' ? 'bg-[#561668] text-white shadow-sm' : 'bg-white hover:bg-[#faf1fa] text-[#4e434e]'
                            }`}
                          >
                            Mensal
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Stats Card */}
                    <div className="bg-[#561668] p-5 rounded-2xl text-white flex flex-col justify-center gap-0.5 shadow-md relative overflow-hidden">
                      <p className="text-[8px] opacity-75 uppercase tracking-widest font-bold">Investimento Total</p>
                      <p className="text-2xl font-extrabold">
                        R$ {bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* History Table */}
                  <div className="silk-lift rounded-3xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#faf1fa]/60 border-b border-[#efe5ee]">
                            <th className="px-6 py-4 font-bold text-[#80737f] text-[10px] uppercase tracking-wider">Data</th>
                            <th className="px-6 py-4 font-bold text-[#80737f] text-[10px] uppercase tracking-wider">Serviço</th>
                            <th className="px-6 py-4 font-bold text-[#80737f] text-[10px] uppercase tracking-wider">Valor</th>
                            <th className="px-6 py-4 font-bold text-[#80737f] text-[10px] uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 font-bold text-[#80737f] text-[10px] uppercase tracking-wider text-center">Avaliação</th>
                            <th className="px-6 py-4 font-bold text-[#80737f] text-[10px] uppercase tracking-wider text-right">Fatura</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#efe5ee]/40 text-xs">
                          {bookings.length > 0 ? (
                            bookings.map((b) => {
                              const isPast = b.date < todayStr;
                              return (
                                <tr key={b.id} className="hover:bg-[#faf1fa]/30 transition-colors">
                                  <td className="px-6 py-5 font-bold text-[#4e434e]">
                                    {new Date(b.date + "T12:00:00").toLocaleDateString('pt-BR')}
                                  </td>
                                  <td className="px-6 py-5">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-[#561668]">Atendimento Pame</span>
                                      <span className="text-[10px] text-[#80737f] mt-0.5">Ref: FAT-{b.id.slice(0, 4).toUpperCase()}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-5 font-bold text-[#561668]">R$ {b.totalPrice}</td>
                                  <td className="px-6 py-5">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                      isPast
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {isPast ? 'Finalizado' : 'Agendado'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-5">
                                    {isPast ? (
                                      <div className="flex justify-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <button
                                            key={star}
                                            onClick={() => handleRateBooking(b.id, star)}
                                            className="focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                                          >
                                            <span
                                              className="material-symbols-outlined text-[18px]"
                                              style={{
                                                fontVariationSettings: (b.rating || 0) >= star ? "'FILL' 1" : "'FILL' 0",
                                                color: (b.rating || 0) >= star ? '#FFD700' : '#d1c2d0'
                                              }}
                                            >
                                              star
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-center text-[10px] text-[#80737f] italic">Pós-Serviço</p>
                                    )}
                                  </td>
                                  <td className="px-6 py-5 text-right">
                                    <button
                                      onClick={() => alert(`Fatura FAT-${b.id.slice(0, 4).toUpperCase()} baixada com sucesso (Simulação).`)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#efe5ee] bg-[#faf1fa] hover:bg-[#efe5ee] text-[#561668] font-bold text-[10px] transition-all cursor-pointer shadow-sm"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                                      Baixar
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6} className="px-6 py-10 text-center text-[#80737f] italic font-semibold">
                                Nenhum registro de atendimento encontrado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── TAB 4: SUPORTE & CONCIERGE ── */}
              {activeTab === 'suporte' && (
                <motion.div
                  key="suporte-tab"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-8 w-full"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="font-display italic text-3xl font-semibold text-[#561668] tracking-tight">
                        Suporte &amp; Concierge
                      </h2>
                      <p className="text-xs text-[#80737f] font-semibold mt-1">
                        Comunicação direta para triagem de urgências, logística residencial e pedidos adicionais.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {displayMessages.length > 1 && (
                        <button
                          onClick={handleClearChat}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#561668]/5 hover:bg-[#561668]/10 text-[#561668] text-[10px] font-extrabold rounded-full tracking-wider border border-[#561668]/10 transition-all cursor-pointer active-scale"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                          LIMPAR CHAT
                        </button>
                      )}

                      <span className="flex items-center gap-2 px-3.5 py-1.5 bg-green-100 text-green-700 text-[10px] font-extrabold rounded-full tracking-wider shadow-inner">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> CONCIERGE ONLINE
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Chat Area (8 Cols) */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                      
                      {/* Chat Shell */}
                      <div className="silk-lift rounded-3xl p-5 md:p-6 flex flex-col bg-[#fff7fd]">
                        <div className="silk-inset bg-[#faf1fa]/50 rounded-2xl h-80 p-4 overflow-y-auto mb-4 flex flex-col gap-3.5 custom-scroll">
                          {displayMessages.map((msg) => {
                            const isUser = msg.sender === 'user';
                            return (
                              <div
                                key={msg.id}
                                className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'ml-auto text-right items-end' : 'text-left'}`}
                              >
                                <div
                                  className={`p-3.5 rounded-2xl text-xs font-semibold leading-relaxed ${
                                    isUser
                                      ? 'bg-[#561668] text-white rounded-tr-none shadow-sm'
                                      : 'bg-[#faf1fa] text-[#4e434e] border border-[#efe5ee] rounded-tl-none'
                                  }`}
                                >
                                  {msg.text}
                                </div>
                                <span className="text-[9px] text-[#80737f] px-1 font-bold uppercase tracking-wider mt-0.5">
                                  {msg.senderName} • {msg.time}
                                </span>
                              </div>
                            );
                          })}

                          {streamingMessage && (
                            <div className="flex flex-col gap-1 max-w-[80%] text-left">
                              <div className="bg-[#faf1fa] text-[#4e434e] border border-[#efe5ee] p-3.5 rounded-2xl rounded-tl-none text-xs font-semibold leading-relaxed">
                                {streamingMessage}
                              </div>
                              <span className="text-[9px] text-[#80737f] px-1 font-bold uppercase tracking-wider mt-0.5">Concierge • Digitando...</span>
                            </div>
                          )}

                          {isTyping && !streamingMessage && (
                            <div className="flex flex-col gap-1 max-w-[80%] text-left">
                              <div className="bg-[#faf1fa] text-[#80737f] border border-[#efe5ee] p-3.5 rounded-2xl rounded-tl-none text-xs flex gap-1.5 items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#80737f] animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#80737f] animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#80737f] animate-bounce" style={{ animationDelay: '300ms' }}></span>
                              </div>
                              <span className="text-[9px] text-[#80737f] px-1 font-bold uppercase tracking-wider">Concierge está digitando...</span>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Input bar */}
                        <div className="flex gap-3">
                          <div className="flex-1 silk-inset bg-[#faf1fa] rounded-xl px-4 py-2.5 flex items-center border border-[#efe5ee]/40">
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                              placeholder="Digite sua mensagem para o concierge..."
                              className="bg-transparent border-none focus:ring-0 w-full text-xs font-medium"
                            />
                            <button
                              onClick={() => alert('Anexo de imagens/documentos (Simulação).')}
                              className="text-[#80737f] hover:text-[#561668] cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[20px]">attach_file</span>
                            </button>
                          </div>
                          <button
                            onClick={handleSendMessage}
                            className="w-12 h-12 bg-[#561668] text-white rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-transform cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[20px]">send</span>
                          </button>
                        </div>
                      </div>

                      {/* FAQs Accordion */}
                      <div className="silk-lift p-6">
                        <h3 className="font-sans text-md font-bold text-[#561668] mb-4 pb-2 border-b border-[#efe5ee]/40">
                          Perguntas Frequentes & Protocolos
                        </h3>
                        <div className="flex flex-col gap-3">
                          {faqs.map((faq, index) => {
                            const isOpen = openFaqIndex === index;
                            return (
                              <div key={index} className="border border-[#efe5ee]/60 rounded-xl overflow-hidden">
                                <button
                                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                  className="w-full flex items-center justify-between p-4 bg-[#faf1fa]/30 hover:bg-[#faf1fa]/60 transition-all text-left cursor-pointer font-bold text-xs text-[#561668]"
                                >
                                  <span>{faq.q}</span>
                                  <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                    expand_more
                                  </span>
                                </button>
                                <AnimatePresence>
                                  {isOpen && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.25 }}
                                    >
                                      <div className="p-4 bg-[#fff] border-t border-[#efe5ee]/40 text-xs text-[#4e434e] leading-relaxed font-semibold">
                                        {faq.a}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* Request Form (4 Cols) */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                      
                      <div className="silk-lift p-6">
                        <h3 className="font-sans text-md font-bold text-[#561668] mb-1">
                          Solicitação Especial
                        </h3>
                        <p className="text-[10px] text-[#80737f] font-semibold mb-6">
                          Para eventos, transportes blindados, enxoval de linho ou chef gourmet privado.
                        </p>

                        <form onSubmit={handleSpecialRequest} className="space-y-4 text-left">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-[#561668] uppercase tracking-wider ml-1">Tipo de Serviço</label>
                            <div className="silk-inset p-3 rounded-xl">
                              <select
                                value={requestType}
                                onChange={(e) => setRequestType(e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-[#4e434e] cursor-pointer"
                              >
                                <option value="Serviços de Catering">Catering & Chef Privado</option>
                                <option value="Transporte Privado">Transporte Executivo</option>
                                <option value="Eventos Especiais">Eventos & Recepção</option>
                                <option value="Enxoval Extra">Enxoval de Linho / Toalhas</option>
                                <option value="Outros">Outras Necessidades</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-[#561668] uppercase tracking-wider ml-1">Data Necessária</label>
                            <div className="silk-inset p-3 rounded-xl">
                              <input
                                type="date"
                                required
                                value={requestDate}
                                onChange={(e) => setRequestDate(e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-[#4e434e]"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-[#561668] uppercase tracking-wider ml-1">Detalhes e Instruções</label>
                            <div className="silk-inset p-3 rounded-xl">
                              <textarea
                                value={requestDetails}
                                onChange={(e) => setRequestDetails(e.target.value)}
                                placeholder="Especifique restrições alimentares, horários ou exigências de protocolo..."
                                rows={4}
                                className="w-full bg-transparent border-none focus:ring-0 text-xs font-medium text-[#4e434e] resize-none"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmittingRequest}
                            className="w-full py-3.5 bg-[#561668] hover:bg-[#703081] text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                          >
                            {isSubmittingRequest ? 'Enviando...' : 'Enviar ao Concierge'}
                          </button>
                        </form>
                      </div>

                      {/* Direct Line prioritária */}
                      <div className="bg-[#561668] text-white p-6 rounded-3xl relative overflow-hidden group shadow-md text-left">
                        <div className="absolute -right-3 -top-3 opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                          <span className="material-symbols-outlined text-[80px]">call</span>
                        </div>
                        <h4 className="font-sans text-md font-bold">Língua Direta</h4>
                        <p className="text-[10px] opacity-75 mt-1 font-semibold leading-relaxed">
                          Para emergências em sua residência ou alterações em menos de 4 horas, ligue diretamente.
                        </p>
                        <a href="tel:+554899999999" className="text-sm font-extrabold flex items-center gap-2 mt-4 hover:underline">
                          <span className="material-symbols-outlined text-[18px]">phone_iphone</span>
                          +55 (48) 9999-9999
                        </a>
                      </div>

                    </div>

                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
      </main>

      {/* ── SUCCESS MODAL (Special Request confirmation) ── */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="p-8 md:p-10 rounded-[32px] bg-[#fff7fd] border border-[#efe5ee] silk-lift max-w-sm w-full text-center flex flex-col items-center gap-5"
            >
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-3xl font-extrabold" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <h3 className="font-sans text-xl font-extrabold text-[#561668]">Solicitação Recebida</h3>
                <p className="text-xs text-[#4e434e] mt-2 font-semibold leading-relaxed">
                  Seu pedido de suporte e logística especial foi enviado diretamente ao Concierge. Em breve enviaremos a confirmação.
                </p>
              </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="mt-2 px-8 py-2.5 bg-[#561668] hover:bg-[#703081] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
