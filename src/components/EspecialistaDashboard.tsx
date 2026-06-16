import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collectionGroup, query, where, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import type { Employee, Booking } from '../types';

// ─────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────
type EspecialistaTab = 'dashboard' | 'agenda' | 'perfil' | 'protocolos';

const NAV_ITEMS: { id: EspecialistaTab; icon: string; label: string }[] = [
  { id: 'dashboard',  icon: 'dashboard',     label: 'Dashboard'   },
  { id: 'agenda',     icon: 'calendar_month', label: 'Agenda'      },
  { id: 'perfil',     icon: 'star',           label: 'Perfil'      },
  { id: 'protocolos', icon: 'auto_stories',   label: 'Protocolos'  },
];

const DAYS_OF_WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const SHIFTS = [
  { id: 'meio_manha', label: 'Manhã' },
  { id: 'meio_tarde', label: 'Tarde' },
  { id: 'completo',   label: 'Integral' },
];

const PROTOCOLS = [
  {
    icon: 'sanitizer',
    title: 'Protocolo de Higienização',
    category: 'Superfícies Nobres',
    badge: '5 etapas',
    color: '#703081',
    steps: [
      'Identificar o tipo de superfície (mármore, granito, cerâmica).',
      'Aplicar produto específico com pano de microfibra em movimentos circulares.',
      'Aguardar o tempo de ação conforme instrução do produto.',
      'Remover com pano limpo e úmido. Secar imediatamente.',
      'Verificar ausência de resíduos e brilho uniforme.',
    ],
    tip: 'Nunca use produtos abrasivos em superfícies polidas.',
  },
  {
    icon: 'cleaning_services',
    title: 'Uso de Vaporizador',
    category: 'Equipamentos Premium',
    badge: '5 etapas',
    color: '#561668',
    steps: [
      'Encher o reservatório com água destilada (nunca água mineral).',
      'Aguardar aquecimento completo (indicador verde).',
      'Manter bocal a 5–10 cm da superfície.',
      'Movimentos lentos e constantes. Não concentrar vapor em um ponto.',
      'Após uso, esvaziar reservatório e secar bocal.',
    ],
    tip: 'Ideal para juntas de azulejos e superfícies porosas.',
  },
  {
    icon: 'fact_check',
    title: 'Checklist Pós-Serviço',
    category: 'Controle de Qualidade',
    badge: 'Obrigatório',
    color: '#703081',
    steps: [
      'Verificar todos os cômodos (iluminação ligada durante o checklist).',
      'Confirmar fechamento de torneiras e janelas.',
      'Registrar foto de cada cômodo finalizado.',
      'Assinar digitalmente o relatório de conclusão.',
      'Notificar cliente com resumo do serviço.',
    ],
    tip: 'O checklist é obrigatório. Sem ele, o serviço não é considerado concluído.',
  },
  {
    icon: 'workspace_premium',
    title: 'Padrão de Apresentação',
    category: 'Código de Conduta',
    badge: 'Conduta',
    color: '#561668',
    steps: [
      'Uniforme completo e limpo (calça, blusa, sapato fechado).',
      'Cabelo preso. Sem acessórios volumosos durante o serviço.',
      'Chegar com no mínimo 10 minutos de antecedência.',
      'Se anunciar na entrada. Nunca entrar sem autorização do morador.',
      'Ao finalizar, despedir-se e perguntar se há alguma observação.',
    ],
    tip: 'A apresentação é a primeira impressão do Método Pame.',
  },
  {
    icon: 'inventory_2',
    title: 'Gestão de Insumos',
    category: 'Materiais e Produtos',
    badge: '5 etapas',
    color: '#703081',
    steps: [
      'Verificar estoque antes de cada serviço.',
      'Usar apenas produtos aprovados pela Pame. Nenhum substituto.',
      'Registrar consumo exato ao final do serviço.',
      'Comunicar baixo estoque com 48h de antecedência.',
      'Nunca deixar embalagens no imóvel do cliente.',
    ],
    tip: 'Produto correto + técnica correta = resultado Método Pame.',
  },
  {
    icon: 'route',
    title: 'Deslocamento e Rotas',
    category: 'Logística',
    badge: '5 etapas',
    color: '#561668',
    steps: [
      'Consultar rota antes de sair de casa.',
      'Sinalizar atraso com no mínimo 30 minutos de antecedência.',
      'Em caso de imprevisto, notificar a coordenação imediatamente.',
      'Não aceitar caronas ou transportar materiais de terceiros.',
      'Registrar chegada e saída.',
    ],
    tip: 'Pontualidade é parte do serviço premium.',
  },
];

// ─────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────
interface Props {
  employee: Employee | null;  // Passed from App.tsx after role detection
}

const DAYS_OF_WEEK_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export default function EspecialistaDashboard({ employee }: Props) {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab]           = useState<EspecialistaTab>('dashboard');
  const [myBookings, setMyBookings]         = useState<Booking[]>([]);
  const [localAvailability, setLocalAvailability] = useState(employee?.weeklyAvailability || {});
  const [savingAvailability, setSavingAvailability] = useState(false);

  // Calendar States for Agenda Tab
  const [agendaMode, setAgendaMode]         = useState<'list' | 'calendar'>('list');
  const [currentDate, setCurrentDate]       = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Profile Edit States
  const [editName, setEditName]             = useState('');
  const [editWhatsapp, setEditWhatsapp]     = useState('');
  const [editZones, setEditZones]           = useState('');
  const [savingProfile, setSavingProfile]   = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  const formatWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers.length > 0 ? `(${numbers}` : '';
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditWhatsapp(formatWhatsApp(e.target.value));
  };

  useEffect(() => {
    if (employee?.weeklyAvailability) {
      setLocalAvailability(employee.weeklyAvailability);
    }
    if (employee) {
      setEditName(employee.name || '');
      setEditWhatsapp(employee.whatsapp || '');
      setEditZones(employee.zones || '');
    }
  }, [employee]);

  const toggleAvailability = (dayIdx: number, shiftId: string) => {
    const currentDay = localAvailability[dayIdx] || [];
    const newDay = currentDay.includes(shiftId as any)
      ? currentDay.filter(s => s !== shiftId)
      : [...currentDay, shiftId as any];
      
    setLocalAvailability({
      ...localAvailability,
      [dayIdx]: newDay
    });
  };

  const saveAvailability = async () => {
    if (!employee?.id) return;
    setSavingAvailability(true);
    try {
      const empRef = doc(db, 'employees', employee.id);
      await updateDoc(empRef, { weeklyAvailability: localAvailability });
      alert('Disponibilidade salva com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar disponibilidade:', err);
      alert('Erro ao salvar disponibilidade.');
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee?.id) return;
    setSavingProfile(true);
    setProfileSuccessMsg('');
    try {
      const empRef = doc(db, 'employees', employee.id);
      await updateDoc(empRef, {
        pendingUpdate: {
          name: editName,
          whatsapp: editWhatsapp,
          zones: editZones,
          requestedAt: new Date().toISOString()
        }
      });
      setProfileSuccessMsg('Solicitação enviada. Aguardando aprovação da coordenação.');
    } catch (err) {
      console.error('Erro ao solicitar alteração de dados:', err);
      alert('Erro ao enviar solicitação.');
    } finally {
      setSavingProfile(false);
    }
  };

  const [loadingBookings, setLoadingBookings] = useState(true);
  const [expandedProtocol, setExpandedProtocol] = useState<number | null>(null);

  // Dynamic Calendar Math
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
    setSelectedBooking(null);
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedBooking(null);
  };

  // ─── Load real bookings assigned to this specialist ──────────────────────────
  useEffect(() => {
    if (!employee?.id) {
      setLoadingBookings(false);
      return;
    }
    const fetchMyBookings = async () => {
      try {
        const q = query(
          collectionGroup(db, 'bookings'),
          where('assignedEmployeeId', '==', employee.id),
          orderBy('date', 'asc')
        );
        const snap = await getDocs(q);
        setMyBookings(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
      } catch (err) {
        console.warn('Bookings query needs Firestore composite index. Falling back to unfiltered.', err);
        // Fallback: try without orderBy (avoids index requirement)
        try {
          const q2 = query(
            collectionGroup(db, 'bookings'),
            where('assignedEmployeeId', '==', employee.id)
          );
          const snap2 = await getDocs(q2);
          setMyBookings(snap2.docs.map(d => ({ docId: d.id, ...d.data() })));
        } catch (err2) {
          console.error('Could not load bookings:', err2);
        }
      } finally {
        setLoadingBookings(false);
      }
    };
    fetchMyBookings();
  }, [employee?.id]);

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const today         = new Date();
  const todayISO      = today.toISOString().split('T')[0];
  const todayStr      = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName     = user?.displayName?.split(' ')[0] || 'Especialista';

  // ─── Address protection: only reveal 24h before the booking ───────────────────
  const isAddressVisible = (bookingDate: string): boolean => {
    const bookingStart = new Date(bookingDate + 'T00:00:00');
    const now = new Date();
    const diffMs = bookingStart.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours <= 24;
  };

  const getAddressDisplay = (booking: Booking): { text: string; revealed: boolean } => {
    if (!booking.address) return { text: 'Endereço não informado', revealed: false };
    if (isAddressVisible(booking.date)) return { text: booking.address, revealed: true };
    // Calculate how much time until reveal
    const bookingStart = new Date(booking.date + 'T00:00:00');
    const now = new Date();
    const diffMs = bookingStart.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remainHours = diffHours % 24;
    const countdown = diffDays > 0
      ? `Disponível em ${diffDays}d ${remainHours}h`
      : `Disponível em ${diffHours}h`;
    return { text: countdown, revealed: false };
  };

  const upcomingBookings  = myBookings.filter(b => b.date >= todayISO && b.status !== 'Cancelado').slice(0, 5);
  const todayBookings     = myBookings.filter(b => b.date === todayISO);
  const completedBookings = myBookings.filter(b => b.status === 'Concluído');

  // Build a week-ahead view
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const dayBookings = myBookings.filter(b => b.date === iso);
    return {
      iso,
      dayNum: d.getDate().toString(),
      dayName: DAYS_OF_WEEK_SHORT[d.getDay()],
      isToday: iso === todayISO,
      bookings: dayBookings,
    };
  });

  const tabTitle = (id: EspecialistaTab) => ({
    dashboard:  `Bem-vinda, ${firstName} ✨`,
    agenda:     'Agenda & Detalhes',
    perfil:     'Perfil & Portfólio',
    protocolos: 'Manual de Protocolos',
  }[id]);

  const photoURL = user?.photoURL
    || employee?.photoURL
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'E')}&background=561668&color=fff`;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: '#fff7fd', fontFamily: 'Manrope, sans-serif', color: '#1e1a20' }}>

      {/* ══════════ SIDEBAR ══════════ */}
      <nav
        className="h-screen w-64 fixed left-0 top-0 flex flex-col py-8 px-4 z-50"
        style={{ background: '#f4ebf4', boxShadow: '4px 0 20px rgba(226,217,230,0.8)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-11 h-11 rounded-xl border border-[#efe5ee] flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn" 
              alt="Logo Método Pame" 
              className="w-8 h-8 object-cover" 
            />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[#561668] leading-tight">Método Pame</h1>
            <p className="text-[9px] text-[#80737f] uppercase tracking-widest font-bold">Área da Especialista</p>
          </div>
        </div>

        {/* Identity card */}
        <div className="flex items-center gap-3 px-2 mb-7 pb-6 border-b border-[#e9e0e8]">
          <img className="w-12 h-12 rounded-full object-cover border-2 border-white silk-lift-sm" src={photoURL} alt="" />
          <div className="min-w-0">
            <p className="font-bold text-[#1e1a20] text-sm leading-tight truncate">{user?.displayName}</p>
            <span className="text-[9px] font-bold uppercase tracking-widest text-white bg-[#561668] px-2 py-0.5 rounded-full mt-0.5 inline-block">
              {employee?.role || 'Especialista'}
            </span>
          </div>
        </div>

        {/* Nav */}
        <div className="flex flex-col gap-1.5 flex-grow">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 w-full ${
                activeTab === item.id
                  ? 'text-[#561668] font-bold bg-[#e9e0e8]'
                  : 'text-[#626264] font-medium hover:bg-[#efe5ee]'
              }`}
            >
              <span className="material-symbols-outlined text-[22px] flex-shrink-0" style={activeTab === item.id ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
              <span className="text-[14px]">{item.label}</span>
              {item.id === 'agenda' && todayBookings.length > 0 && (
                <span className="ml-auto bg-[#561668] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{todayBookings.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Bottom */}
        <div className="flex flex-col gap-1 pt-5 border-t border-[#e9e0e8]">
          <a 
            className="flex items-center gap-3 px-4 py-2 text-[#d1c2d0] hover:text-[#561668] transition-all text-[11px] font-bold uppercase tracking-widest cursor-pointer" 
            href="https://wa.me/554899999999" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <span className="material-symbols-outlined text-[18px]">help</span> Ajuda
          </a>
          <button
            onClick={() => signOut?.()}
            className="flex items-center gap-3 px-4 py-2 text-[#d1c2d0] hover:text-[#ba1a1a] transition-all text-[11px] font-bold uppercase tracking-widest w-full text-left"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span> Sair
          </button>
        </div>
      </nav>

      {/* ══════════ TOP BAR ══════════ */}
      <header
        className="fixed top-0 right-0 z-40 flex justify-between items-center h-20 px-8"
        style={{
          width: 'calc(100% - 16rem)',
          background: 'rgba(255,247,253,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(209,194,208,0.3)',
        }}
      >
        <div>
          <h2 className="text-xl font-bold text-[#561668]">{tabTitle(activeTab)}</h2>
          <p className="text-[11px] text-[#80737f] font-bold uppercase tracking-widest capitalize">{todayStr}</p>
        </div>
        <div className="flex items-center gap-4">
          {todayBookings.length > 0 && (
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold silk-lift" style={{ background: '#561668' }} onClick={() => setActiveTab('agenda')}>
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              {todayBookings.length} hoje
            </button>
          )}
          <img className="w-10 h-10 rounded-full object-cover silk-lift-sm border-2 border-white" src={photoURL} alt="" />
        </div>
      </header>

      {/* ══════════ MAIN CONTENT ══════════ */}
      <main className="ml-64 flex-1 pt-28 pb-16 px-8 min-h-screen">

        {/* ╔═══════════════════════╗
            ║   DASHBOARD           ║
            ╚═══════════════════════╝ */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Welcome */}
            <section className="mb-10">
              <h1 className="text-[44px] font-extrabold text-[#561668] leading-tight mb-2">
                Olá, {firstName}.
              </h1>
              <p className="text-lg text-[#80737f]">Sua excelência hoje define o padrão de amanhã.</p>
            </section>

            {/* KPI Bento — dados reais */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="silk-lift rounded-3xl p-8 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300">
                <div className="flex justify-between items-start mb-6">
                  <span className="material-symbols-outlined text-[#561668] p-3 bg-[#e9e0e8] rounded-2xl text-[24px]">star_rate</span>
                  <span className="text-[11px] font-bold text-[#561668] bg-[#fcd7ff] px-3 py-1 rounded-full">⭐ Rating</span>
                </div>
                <div>
                  <p className="text-[10px] text-[#80737f] uppercase tracking-widest font-bold mb-1">Avaliação</p>
                  <h3 className="text-[32px] font-bold text-[#1e1a20]">4.98</h3>
                </div>
              </div>

              <div className="silk-lift rounded-3xl p-8 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300">
                <div className="flex justify-between items-start mb-6">
                  <span className="material-symbols-outlined text-[#561668] p-3 bg-[#e9e0e8] rounded-2xl text-[24px]">task_alt</span>
                  {todayBookings.length > 0 && (
                    <span className="text-[11px] font-bold text-[#561668] bg-[#fcd7ff] px-3 py-1 rounded-full">{todayBookings.length} hoje</span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-[#80737f] uppercase tracking-widest font-bold mb-1">Serviços Concluídos</p>
                  <h3 className="text-[32px] font-bold text-[#1e1a20]">{loadingBookings ? '…' : completedBookings.length}</h3>
                </div>
              </div>

              <div className="silk-lift rounded-3xl p-8 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300">
                <div className="flex justify-between items-start mb-6">
                  <span className="material-symbols-outlined text-[#561668] p-3 bg-[#e9e0e8] rounded-2xl text-[24px]">calendar_month</span>
                </div>
                <div>
                  <p className="text-[10px] text-[#80737f] uppercase tracking-widest font-bold mb-1">Próximos Serviços</p>
                  <h3 className="text-[32px] font-bold text-[#1e1a20]">{loadingBookings ? '…' : upcomingBookings.length}</h3>
                </div>
              </div>
            </section>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Upcoming services */}
              <div className="lg:col-span-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-[#1e1a20]">Próximos Serviços</h2>
                  <button className="text-[#561668] font-bold text-sm hover:underline" onClick={() => setActiveTab('agenda')}>Ver todos →</button>
                </div>

                {loadingBookings ? (
                  <div className="silk-lift rounded-3xl p-10 text-center text-[#80737f]">Carregando seus serviços...</div>
                ) : upcomingBookings.length === 0 ? (
                  <div className="silk-lift rounded-3xl p-12 text-center flex flex-col items-center">
                    <span className="material-symbols-outlined text-5xl text-[#d1c2d0] mb-3">event_available</span>
                    <p className="text-[#80737f] font-medium">Nenhum serviço agendado ainda.</p>
                    <p className="text-sm text-[#d1c2d0] mt-1">Quando a coordenação te atribuir um serviço, ele aparecerá aqui.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {upcomingBookings.map((b, i) => {
                      const isToday = b.date === todayISO;
                      const statusColor = b.status === 'Concluído' ? 'bg-green-50 text-green-700' : b.status === 'Cancelado' ? 'bg-red-50 text-red-600' : 'bg-[#e9e0e8] text-[#561668]';
                      return (
                        <div
                          key={b.docId || i}
                          className={`silk-lift rounded-[28px] p-6 flex items-center gap-5 hover:scale-[1.01] transition-transform duration-200 cursor-pointer ${isToday ? 'border-l-4 border-[#561668]' : ''}`}
                        >
                          {/* Date block */}
                          <div
                            className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-white font-bold"
                            style={{ background: isToday ? '#561668' : '#e9e0e8', color: isToday ? 'white' : '#561668' }}
                          >
                            <span className="text-[10px] uppercase tracking-widest opacity-80">
                              {b.date ? new Date(b.date + 'T00:00').toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase() : '—'}
                            </span>
                            <span className="text-2xl leading-none">
                              {b.date ? new Date(b.date + 'T00:00').getDate() : '—'}
                            </span>
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            {isToday && <p className="text-[10px] font-extrabold text-[#561668] uppercase tracking-widest mb-1">HOJE</p>}
                            <h3 className="font-bold text-[#1e1a20] text-base truncate">{b.name || 'Cliente'}</h3>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[10px] font-bold bg-[#f4ebf4] text-[#626264] px-2 py-1 rounded-full">
                                {b.time || 'Horário a confirmar'} · {b.format === 'meio' ? 'Meio Turno' : 'Turno Completo'}
                              </span>
                              {b.totalPrice > 0 && (
                                <span className="text-[10px] font-bold bg-[#fcd7ff] text-[#561668] px-2 py-1 rounded-full">R$ {b.totalPrice}</span>
                              )}
                            </div>
                            {/* Address with 24h protection */}
                            {(() => {
                              const addr = getAddressDisplay(b);
                              return (
                                <div className={`flex items-center gap-1.5 mt-2 text-[11px] ${addr.revealed ? 'text-[#1e1a20]' : 'text-[#b0a3af]'}`}>
                                  <span className="material-symbols-outlined text-[14px]" style={addr.revealed ? {} : { fontVariationSettings: "'FILL' 1" }}>
                                    {addr.revealed ? 'location_on' : 'lock'}
                                  </span>
                                  <span className={`truncate ${addr.revealed ? 'font-medium' : 'italic'}`}>{addr.text}</span>
                                </div>
                              );
                            })()}
                          </div>
                          {/* Status + actions */}
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl ${statusColor}`}>
                              {b.status || 'Confirmado'}
                            </span>
                            {isToday && (
                              <button className="text-[11px] font-bold text-[#561668] hover:underline">Ver Detalhes →</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Weekly mini-calendar */}
              <div className="lg:col-span-4 silk-lift rounded-[2.5rem] p-8">
                <h2 className="text-base font-bold text-[#1e1a20] mb-6">Próximos 7 Dias</h2>
                <div className="flex flex-col gap-3">
                  {weekDays.map(d => (
                    <div key={d.iso} className={`flex items-center gap-3 ${d.bookings.length === 0 ? 'opacity-50' : ''}`}>
                      <div
                        className="flex flex-col items-center justify-center w-14 h-14 rounded-xl flex-shrink-0 font-bold"
                        style={{ background: d.isToday ? '#561668' : '#e9e0e8', color: d.isToday ? 'white' : '#561668' }}
                      >
                        <span className="text-[9px] uppercase tracking-widest">{d.dayName}</span>
                        <span className="text-xl leading-none">{d.dayNum}</span>
                      </div>
                      {d.bookings.length > 0 ? (
                        <div className="flex-1 silk-inset p-3 rounded-xl">
                          <p className="text-[10px] font-extrabold text-[#561668] uppercase tracking-widest">{d.bookings.length} serviço{d.bookings.length > 1 ? 's' : ''}</p>
                          <p className="text-[11px] text-[#1e1a20] font-medium truncate">{d.bookings.map(b => b.name || 'Cliente').join(', ')}</p>
                        </div>
                      ) : (
                        <div className="flex-1 border border-dashed border-[#d1c2d0] rounded-xl p-3">
                          <p className="text-[11px] text-[#80737f]">Dia livre</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button className="w-full mt-6 py-3.5 text-[#561668] font-bold border border-[#561668]/20 rounded-2xl hover:bg-[#561668]/5 transition-colors text-sm" onClick={() => setActiveTab('agenda')}>
                  Ver Agenda Completa →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ╔═══════════════════════╗
            ║   AGENDA & DETALLES   ║
            ╚═══════════════════════╝ */}
        {activeTab === 'agenda' && (
          <div className="flex flex-col gap-6">
            {/* Mode Selector */}
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#efe5ee]/40">
              <div>
                <h3 className="text-sm font-bold text-[#561668] uppercase tracking-widest">Visualização da Agenda</h3>
                <p className="text-[10px] text-[#80737f] font-semibold mt-0.5">Alterne entre o modo de lista semanal e a grade mensal.</p>
              </div>
              <div className="flex bg-[#e9e0e8]/50 p-1 rounded-xl">
                <button
                  onClick={() => setAgendaMode('list')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    agendaMode === 'list' ? 'bg-[#561668] text-white shadow-sm' : 'text-[#561668] hover:bg-[#e9e0e8]/50'
                  }`}
                >
                  Modo Lista
                </button>
                <button
                  onClick={() => setAgendaMode('calendar')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    agendaMode === 'calendar' ? 'bg-[#561668] text-white shadow-sm' : 'text-[#561668] hover:bg-[#e9e0e8]/50'
                  }`}
                >
                  Modo Calendário
                </button>
              </div>
            </div>

            {/* ── MODO LISTA ── */}
            {agendaMode === 'list' && (
              <div>
                {/* Week selector */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                  {weekDays.map(d => (
                    <div
                      key={d.iso}
                      className={`flex flex-col items-center justify-center min-w-[60px] h-20 rounded-2xl font-bold flex-shrink-0 relative ${
                        d.isToday ? 'text-white' : 'silk-lift text-[#561668]'
                      }`}
                      style={d.isToday ? { background: '#561668' } : {}}
                    >
                      <span className="text-[10px] uppercase tracking-widest">{d.dayName}</span>
                      <span className="text-2xl leading-none">{d.dayNum}</span>
                      {d.bookings.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center text-white" style={{ background: d.isToday ? 'rgba(255,255,255,0.3)' : '#561668' }}>
                          {d.bookings.length}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Booking cards */}
                {loadingBookings ? (
                  <div className="silk-lift rounded-3xl p-12 text-center text-[#80737f]">Carregando agenda...</div>
                ) : myBookings.length === 0 ? (
                  <div className="silk-lift rounded-3xl p-16 text-center flex flex-col items-center">
                    <span className="material-symbols-outlined text-6xl text-[#d1c2d0] mb-4">event_busy</span>
                    <h3 className="text-lg font-bold text-[#561668] mb-2">Agenda vazia</h3>
                    <p className="text-[#80737f] text-sm max-w-xs">Quando a coordenação atribuir serviços a você, eles aparecerão aqui automaticamente.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {myBookings.filter(b => b.status !== 'Cancelado').map((b, i) => {
                      const isToday = b.date === todayISO;
                      const statusColor = b.status === 'Concluído' ? 'bg-green-50 text-green-700' : 'bg-[#e9e0e8] text-[#561668]';
                      const statusDot = b.status === 'Concluído' ? 'bg-green-500' : 'bg-[#561668] animate-pulse';
                      return (
                        <div key={b.docId || i} className="silk-lift rounded-[2rem] overflow-hidden">
                          {/* Color header */}
                          <div className="px-8 py-5 flex justify-between items-center" style={{ background: isToday ? '#561668' : '#f4ebf4' }}>
                            <div>
                              <p className={`text-[10px] font-extrabold uppercase tracking-widest mb-1 ${isToday ? 'text-white/70' : 'text-[#80737f]'}`}>
                                {isToday ? 'HOJE' : b.date || '—'} · {b.time || 'Horário a confirmar'}
                              </p>
                              <h3 className={`text-xl font-extrabold ${isToday ? 'text-white' : 'text-[#1e1a20]'}`}>{b.name || 'Cliente'}</h3>
                            </div>
                            <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${isToday ? 'bg-white/20 text-white' : statusColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : statusDot}`} />
                              {b.status || 'Confirmado'}
                            </span>
                          </div>
                          {/* Details */}
                          <div className="p-7">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                              {[
                                { icon: 'schedule',  label: 'Turno',     value: b.format === 'meio' ? 'Meio Turno' : 'Turno Completo' },
                                { icon: 'payments',  label: 'Valor',     value: b.totalPrice > 0 ? `R$ ${b.totalPrice}` : 'A confirmar' },
                                { icon: 'info',      label: 'Status',    value: b.status || 'Confirmado' },
                              ].map(d => (
                                <div key={d.label} className="silk-inset p-4 rounded-2xl">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-[#561668] text-[16px]">{d.icon}</span>
                                    <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest">{d.label}</p>
                                  </div>
                                  <p className="text-sm font-semibold text-[#1e1a20]">{d.value}</p>
                                </div>
                              ))}
                            </div>
                            {/* Address with 24h protection */}
                            {(() => {
                              const addr = getAddressDisplay(b);
                              return (
                                <div className={`silk-inset p-4 rounded-2xl mb-6 flex items-center gap-3 ${addr.revealed ? '' : 'opacity-75'}`}>
                                  <span
                                    className="material-symbols-outlined text-[20px] flex-shrink-0"
                                    style={{ color: addr.revealed ? '#561668' : '#b0a3af', ...(addr.revealed ? {} : { fontVariationSettings: "'FILL' 1" }) }}
                                  >
                                    {addr.revealed ? 'location_on' : 'lock'}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest mb-1">Endereço</p>
                                    {addr.revealed ? (
                                      <p className="text-sm font-semibold text-[#1e1a20]">{addr.text}</p>
                                    ) : (
                                      <p className="text-sm font-medium text-[#b0a3af] italic">{addr.text}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Checklist */}
                            <div>
                              <h4 className="text-[11px] font-bold text-[#561668] uppercase tracking-widest mb-3">Checklist do Serviço</h4>
                              <div className="flex flex-col gap-2">
                                {['Verificar materiais e insumos', 'Foto inicial de cada cômodo', 'Aplicar protocolo de higienização', 'Foto final e checklist de saída', 'Assinar conclusão'].map((item, j) => (
                                  <div key={j} className="flex items-center gap-3 p-3 silk-inset rounded-xl">
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${b.status === 'Concluído' ? 'bg-green-500 border-green-500' : 'border-[#d1c2d0]'}`}>
                                      {b.status === 'Concluído' && <span className="material-symbols-outlined text-white text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
                                    </div>
                                    <span className={`text-sm ${b.status === 'Concluído' ? 'line-through text-[#d1c2d0]' : 'text-[#1e1a20]'}`}>{item}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── MODO CALENDÁRIO ── */}
            {agendaMode === 'calendar' && (
              <div className="flex flex-col gap-6">
                <div className="silk-lift p-6 rounded-3xl">
                  {/* Calendar Header */}
                  <div className="flex justify-between items-center mb-6">
                    <button
                      onClick={handlePrevMonth}
                      className="w-10 h-10 rounded-xl hover:bg-[#faf1fa] text-[#561668] flex items-center justify-center cursor-pointer border border-[#efe5ee]"
                    >
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <h3 className="font-sans text-base font-extrabold text-[#561668]">
                      {monthNames[month]} {year}
                    </h3>
                    <button
                      onClick={handleNextMonth}
                      className="w-10 h-10 rounded-xl hover:bg-[#faf1fa] text-[#561668] flex items-center justify-center cursor-pointer border border-[#efe5ee]"
                    >
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>

                  {/* Week Headers */}
                  <div className="grid grid-cols-7 border-b border-[#efe5ee]/40 pb-3 mb-3 text-center text-[10px] font-bold text-[#80737f] tracking-wider">
                    <div>SEG</div>
                    <div>TER</div>
                    <div>QUA</div>
                    <div>QUI</div>
                    <div>SEX</div>
                    <div className="text-[#703081]">SÁB</div>
                    <div className="text-[#703081]">DOM</div>
                  </div>

                  {/* Day Cells */}
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
                      const dayBookings = myBookings.filter(b => b.date === dayStr && b.status !== 'Cancelado');
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

                {/* Selected Day Details */}
                {selectedBooking ? (
                  <div className="silk-lift rounded-[2rem] overflow-hidden border border-[#efe5ee]/40">
                    <div className="px-8 py-5 flex justify-between items-center bg-[#561668] text-white">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest mb-1 text-white/70">
                          {selectedBooking.date} · {selectedBooking.time || 'Horário a confirmar'}
                        </p>
                        <h3 className="text-xl font-extrabold text-white">{selectedBooking.name || 'Cliente'}</h3>
                      </div>
                      <span className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-white/20 text-white flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        {selectedBooking.status || 'Confirmado'}
                      </span>
                    </div>
                    <div className="p-7 bg-white">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        {[
                          { icon: 'schedule',  label: 'Turno',     value: selectedBooking.format === 'meio' ? 'Meio Turno' : 'Turno Completo' },
                          { icon: 'payments',  label: 'Valor',     value: selectedBooking.totalPrice > 0 ? `R$ ${selectedBooking.totalPrice}` : 'A confirmar' },
                          { icon: 'info',      label: 'Status',    value: selectedBooking.status || 'Confirmado' },
                        ].map(d => (
                          <div key={d.label} className="silk-inset p-4 rounded-2xl">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="material-symbols-outlined text-[#561668] text-[16px]">{d.icon}</span>
                              <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest">{d.label}</p>
                            </div>
                            <p className="text-sm font-semibold text-[#1e1a20]">{d.value}</p>
                          </div>
                        ))}
                      </div>
                      {/* Address with 24h protection */}
                      {(() => {
                        const addr = getAddressDisplay(selectedBooking);
                        return (
                          <div className={`silk-inset p-4 rounded-2xl mb-6 flex items-center gap-3 ${addr.revealed ? '' : 'opacity-75'}`}>
                            <span
                              className="material-symbols-outlined text-[20px] flex-shrink-0"
                              style={{ color: addr.revealed ? '#561668' : '#b0a3af', ...(addr.revealed ? {} : { fontVariationSettings: "'FILL' 1" }) }}
                            >
                              {addr.revealed ? 'location_on' : 'lock'}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest mb-1">Endereço</p>
                              {addr.revealed ? (
                                <p className="text-sm font-semibold text-[#1e1a20]">{addr.text}</p>
                              ) : (
                                <p className="text-sm font-medium text-[#b0a3af] italic">{addr.text}</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      <div>
                        <h4 className="text-[11px] font-bold text-[#561668] uppercase tracking-widest mb-3">Checklist do Serviço</h4>
                        <div className="flex flex-col gap-2">
                          {['Verificar materiais e insumos', 'Foto inicial de cada cômodo', 'Aplicar protocolo de higienização', 'Foto final e checklist de saída', 'Assinar conclusão'].map((item, j) => (
                            <div key={j} className="flex items-center gap-3 p-3 silk-inset rounded-xl">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedBooking.status === 'Concluído' ? 'bg-green-500 border-green-500' : 'border-[#d1c2d0]'}`}>
                                {selectedBooking.status === 'Concluído' && <span className="material-symbols-outlined text-white text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
                              </div>
                              <span className={`text-sm ${selectedBooking.status === 'Concluído' ? 'line-through text-[#d1c2d0]' : 'text-[#1e1a20]'}`}>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="silk-lift rounded-3xl p-8 text-center text-[#80737f] italic font-semibold">
                    Selecione um dia com atendimento no calendário para visualizar os detalhes.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ╔═══════════════════════╗
            ║   PERFIL              ║
            ╚═══════════════════════╝ */}
        {activeTab === 'perfil' && (
          <div>
            {/* Hero */}
            <div className="silk-lift rounded-[2.5rem] overflow-hidden mb-8">
              <div className="h-36" style={{ background: 'linear-gradient(135deg, #561668 0%, #703081 60%, #eca1fb 100%)' }} />
              <div className="px-8 pb-8">
                <div className="flex flex-col md:flex-row items-start md:items-end gap-6 -mt-14 mb-6">
                  <img
                    className="w-28 h-28 rounded-full border-4 border-white silk-lift object-cover"
                    src={photoURL}
                    alt={user?.displayName || ''}
                  />
                  <div className="md:mb-2">
                    <h1 className="text-3xl font-extrabold text-[#1e1a20]">{user?.displayName}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-[#561668] px-2.5 py-1 rounded-full">{employee?.role || 'Especialista Pame'}</span>
                      {employee?.zones && <span className="text-[10px] text-[#80737f] font-bold">📍 {employee.zones}</span>}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {[
                    { value: completedBookings.length.toString(), label: 'Concluídos', icon: 'task_alt' },
                    { value: upcomingBookings.length.toString(),  label: 'Próximos',   icon: 'calendar_month' },
                    { value: '4.98',                               label: 'Rating',     icon: 'star' },
                  ].map(s => (
                    <div key={s.label} className="silk-inset rounded-2xl p-5 text-center">
                      <span className="material-symbols-outlined text-[#561668] text-[22px] mb-2 block" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                      <p className="text-2xl font-extrabold text-[#561668]">{s.value}</p>
                      <p className="text-[10px] text-[#80737f] uppercase tracking-widest font-bold mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Availability Grid */}
                <div>
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-sm font-bold text-[#561668] uppercase tracking-widest">Disponibilidade Semanal</h3>
                    <button 
                      onClick={saveAvailability}
                      disabled={savingAvailability}
                      className="text-[10px] uppercase tracking-widest font-bold bg-[#561668] text-white px-4 py-2 rounded-full flex items-center gap-1.5 hover:bg-[#703081] transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[14px]">save</span>
                      {savingAvailability ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {DAYS_OF_WEEK_FULL.map((dayName, idx) => (
                      <div key={dayName} className="silk-inset rounded-2xl p-4 flex flex-col gap-3">
                        <p className="text-xs font-bold text-[#561668] uppercase tracking-wider">{dayName}</p>
                        <div className="flex flex-wrap gap-2">
                          {SHIFTS.map(shift => {
                            const isAvail = localAvailability[idx]?.includes(shift.id as any);
                            return (
                              <button
                                key={shift.id}
                                onClick={() => toggleAvailability(idx, shift.id)}
                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                                  isAvail
                                    ? 'bg-[#561668] text-white shadow-sm'
                                    : 'border border-[#efe5ee] bg-white text-[#4e434e] hover:bg-[#faf1fa]'
                                }`}
                              >
                                {shift.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#80737f] mt-4 text-center">Modifique e salve sua disponibilidade para os turnos da semana.</p>
                </div>
              </div>
            </div>

            {/* Contact info / Edit profile */}
            <div className="silk-lift rounded-3xl p-7 mt-8">
              <h3 className="text-sm font-bold text-[#561668] uppercase tracking-widest mb-5">Meus Dados</h3>
              
              {employee?.pendingUpdate && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">pending</span>
                  <span>Solicitação de alteração enviada. Aguardando aprovação da coordenação.</span>
                </div>
              )}

              {profileSuccessMsg && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-[#561668] uppercase tracking-wider ml-1">Nome Completo</label>
                    <div className="silk-inset p-3 rounded-xl">
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-[#4e434e]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-[#561668] uppercase tracking-wider ml-1">WhatsApp</label>
                    <div className="silk-inset p-3 rounded-xl">
                      <input
                        type="text"
                        required
                        value={editWhatsapp}
                        onChange={handleWhatsappChange}
                        placeholder="(48) 99999-9999"
                        className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-[#4e434e]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-[#561668] uppercase tracking-wider ml-1">Zonas de Atendimento</label>
                  <div className="silk-inset p-3 rounded-xl">
                    <input
                      type="text"
                      required
                      value={editZones}
                      onChange={(e) => setEditZones(e.target.value)}
                      placeholder="Ex: Norte da Ilha, Centro, Trindade"
                      className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-[#4e434e]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-[#efe5ee]/40">
                  <div className="flex items-center gap-3 silk-inset p-3.5 rounded-xl opacity-75">
                    <span className="material-symbols-outlined text-[#80737f] text-[20px]">email</span>
                    <div>
                      <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest">Email (Não editável)</p>
                      <p className="text-xs font-semibold text-[#80737f]">{employee?.email}</p>
                    </div>
                  </div>
                  {employee?.cpf && (
                    <div className="flex items-center gap-3 silk-inset p-3.5 rounded-xl opacity-75">
                      <span className="material-symbols-outlined text-[#80737f] text-[20px]">fingerprint</span>
                      <div>
                        <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest">CPF (Não editável)</p>
                        <p className="text-xs font-semibold text-[#80737f]">{employee.cpf}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-6 py-2.5 bg-[#561668] text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-[#703081] transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                  >
                    {savingProfile ? 'Salvando...' : 'Solicitar Alteração'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ╔═══════════════════════╗
            ║   PROTOCOLOS          ║
            ╚═══════════════════════╝ */}
        {activeTab === 'protocolos' && (
          <div>
            {/* Intro Banner */}
            <div className="rounded-3xl p-8 mb-10 relative overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #561668 0%, #703081 100%)' }}>
              <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-10 bg-white" />
              <div className="relative z-10 flex items-center gap-4 mb-3">
                <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                <div>
                  <h2 className="text-2xl font-extrabold">Manual de Protocolos</h2>
                  <p className="text-[11px] uppercase tracking-widest opacity-80 font-bold">Método Pame · Edição 2024</p>
                </div>
              </div>
              <p className="text-sm opacity-80 leading-relaxed max-w-2xl relative z-10">
                Este manual contém os protocolos oficiais do Método Pame. Siga cada etapa com atenção — o padrão de excelência começa pelo procedimento correto.
              </p>
            </div>

            {/* Accordion */}
            <div className="flex flex-col gap-4">
              {PROTOCOLS.map((p, i) => (
                <div key={i} className={`silk-lift rounded-3xl overflow-hidden transition-all duration-300 ${expandedProtocol === i ? 'ring-2 ring-[#561668]/20' : ''}`}>
                  <button
                    className="w-full flex items-center gap-5 p-7 text-left hover:bg-[#faf1fa] transition-colors"
                    onClick={() => setExpandedProtocol(expandedProtocol === i ? null : i)}
                  >
                    <div className="p-4 rounded-2xl flex-shrink-0" style={{ background: p.color }}>
                      <span className="material-symbols-outlined text-[#eca1fb] text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>{p.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest">{p.category}</span>
                        <span className="text-[10px] font-bold bg-[#e9e0e8] text-[#561668] px-2 py-0.5 rounded-full">{p.badge}</span>
                      </div>
                      <h3 className="font-bold text-[#1e1a20] text-base">{p.title}</h3>
                    </div>
                    <span className={`material-symbols-outlined text-[#561668] flex-shrink-0 transition-transform duration-300 ${expandedProtocol === i ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>

                  {expandedProtocol === i && (
                    <div className="px-7 pb-7 border-t border-[#e9e0e8]">
                      <div className="pt-6 flex flex-col gap-3 mb-5">
                        {p.steps.map((step, j) => (
                          <div key={j} className="flex items-start gap-4">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-[11px] text-white flex-shrink-0 mt-0.5" style={{ background: p.color }}>
                              {j + 1}
                            </div>
                            <p className="text-sm text-[#4e434e] leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                      <div className="silk-inset rounded-2xl p-5 flex items-start gap-3">
                        <span className="material-symbols-outlined text-[#561668] text-[20px] flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
                        <div>
                          <p className="text-[10px] font-extrabold text-[#561668] uppercase tracking-widest mb-1">Dica Pame</p>
                          <p className="text-sm text-[#4e434e] italic">{p.tip}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-10 p-7 rounded-3xl silk-inset text-center">
              <span className="material-symbols-outlined text-[#561668] text-[32px] mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
              <p className="text-sm text-[#80737f] leading-relaxed">
                Manual de uso exclusivo das especialistas do Método Pame. Em caso de dúvidas, entre em contato com a coordenação.
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
