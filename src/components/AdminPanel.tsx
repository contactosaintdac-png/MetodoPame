import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, collectionGroup, onSnapshot, orderBy } from 'firebase/firestore';
import { notifyEmployeeRemoval, notifyEmployeeAssignment } from '../lib/NotificationService';

import type { Employee, Booking } from '../types';

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SHIFTS = [
  { id: 'meio_manha', label: 'Manhã' },
  { id: 'meio_tarde', label: 'Tarde' },
  { id: 'completo', label: 'Integral' },
];

type AdminTab = 'dashboard' | 'agenda' | 'equipe' | 'recrutamento' | 'indicacoes' | 'concierge';

const NAV_ITEMS: { id: AdminTab; icon: string; label: string }[] = [
  { id: 'dashboard',    icon: 'dashboard',    label: 'Dashboard'    },
  { id: 'agenda',       icon: 'calendar_today', label: 'Agenda'     },
  { id: 'equipe',       icon: 'group',        label: 'Equipe'       },
  { id: 'recrutamento', icon: 'badge',         label: 'Recrutamento' },
  { id: 'indicacoes',   icon: 'stars',         label: 'Indicações'   },
  { id: 'concierge',    icon: 'chat',          label: 'Mensagens'    },
];

export default function AdminPanel({ onScreenChange }: { onScreenChange: (screen: string) => void }) {
  const { user, signInWithGoogle } = useAuth();

  const [employees, setEmployees]           = useState<Employee[]>([]);
  const [bookings, setBookings]             = useState<any[]>([]);
  const [referrals, setReferrals]           = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [activeTab, setActiveTab]           = useState<AdminTab>('dashboard');
  const [agendaView, setAgendaView]         = useState<'lista' | 'calendario'>('calendario');
  const [agendaDate, setAgendaDate]         = useState<Date>(new Date());

  const [showAddModal, setShowAddModal]     = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [newEmpName, setNewEmpName]         = useState('');
  const [newEmpRole, setNewEmpRole]         = useState('Especialista em Limpeza');

  const [editingEmployee, setEditingEmployee]   = useState<Employee | null>(null);
  const [editFormData, setEditFormData]         = useState<Partial<Employee>>({});

  const [showEditBookingModal, setShowEditBookingModal] = useState(false);
  const [editingBooking, setEditingBooking]             = useState<any>(null);
  const [editBookingData, setEditBookingData]           = useState<any>({});

  const [activeChats, setActiveChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatMessages, setSelectedChatMessages] = useState<any[]>([]);

  // ─── Data fetching ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      fetchEmployees();
      const unsubscribeChats = onSnapshot(query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc')), (snap) => {
        const chats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActiveChats(chats);
      });
      return () => unsubscribeChats();
    }
  }, [user]);

  useEffect(() => {
    if (selectedChatId) {
      const q = query(collection(db, 'chats', selectedChatId, 'messages'), orderBy('createdAt', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        setSelectedChatMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      // Mark as read
      updateDoc(doc(db, 'chats', selectedChatId), { hasUnreadAdmin: false }).catch(console.error);
      return () => unsub();
    } else {
      setSelectedChatMessages([]);
    }
  }, [selectedChatId]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'employees')));
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
      try {
        const bSnap = await getDocs(query(collectionGroup(db, 'bookings')));
        setBookings(bSnap.docs.map(d => ({ docId: d.id, ref: d.ref, ...d.data() })));
      } catch (e) {
        console.warn('collectionGroup bookings indisponível — necessita index.', e);
      }
      try {
        const rSnap = await getDocs(query(collection(db, 'referrals')));
        setReferrals(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn('collection referrals fetch falhou.', e);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReferral = async (referralId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'referrals', referralId), { status: newStatus, updatedAt: serverTimestamp() });
      fetchEmployees(); // Re-fetch everything to update list
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Employee Handlers ────────────────────────────────────────────────────────
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName) return;
    const newEmp = {
      name: newEmpName,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(newEmpName)}&background=561668&color=fff`,
      role: newEmpRole,
      assignedServices: 0,
      weeklyAvailability: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
      createdAt: serverTimestamp(),
    };
    try {
      await addDoc(collection(db, 'employees'), newEmp);
      setShowAddModal(false);
      setNewEmpName('');
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  const toggleAvailability = async (empId: string, dayIdx: number, shiftId: string, currentAvail: any) => {
    const dayAvail: string[] = currentAvail[dayIdx] || [];
    const newDayAvail = dayAvail.includes(shiftId)
      ? dayAvail.filter((s: string) => s !== shiftId)
      : [...dayAvail, shiftId];
    const newWeeklyAvail = { ...currentAvail, [dayIdx]: newDayAvail };
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, weeklyAvailability: newWeeklyAvail } : e));
    try {
      await updateDoc(doc(db, 'employees', empId), { weeklyAvailability: newWeeklyAvail });
    } catch (err) { console.error(err); fetchEmployees(); }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    try {
      await updateDoc(doc(db, 'employees', editingEmployee.id), editFormData);
      setShowEditModal(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  const handleApproveCandidate = async (empId: string) => {
    try {
      await updateDoc(doc(db, 'employees', empId), { status: 'active', active: true });
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  const handleRejectCandidate = async (empId: string) => {
    if (confirm('Tem certeza que deseja rejeitar e apagar esta candidatura?')) {
      try { await deleteDoc(doc(db, 'employees', empId)); fetchEmployees(); }
      catch (err) { console.error(err); }
    }
  };

  const handleDeleteEmployee = async (empId: string) => {
    if (confirm('Tem certeza que deseja desativar (ocultar) esta especialista?')) {
      try { await updateDoc(doc(db, 'employees', empId), { active: false }); fetchEmployees(); }
      catch (err) { console.error(err); }
    }
  };

  const handleHardDeleteEmployee = async (empId: string) => {
    if (confirm('🚨 ATENÇÃO: Deletar DEFINITIVAMENTE esta especialista? Esta ação não pode ser desfeita.')) {
      try { await deleteDoc(doc(db, 'employees', empId)); fetchEmployees(); }
      catch (err) { console.error(err); }
    }
  };

  // ─── Booking Handlers ─────────────────────────────────────────────────────────
  const handleDeleteBooking = async (bookingRef: any) => {
    if (confirm('🚨 ATENÇÃO: Deletar DEFINITIVAMENTE este agendamento?')) {
      try { await deleteDoc(bookingRef); fetchEmployees(); }
      catch (err) { console.error(err); }
    }
  };

  const handleDeleteAllBookings = async () => {
    if (confirm('🚨 PERIGO EXTREMO: Apagar TODAS AS RESERVAS do sistema?')) {
      const input = prompt('Digite CONFIRMAR para continuar:');
      if (input === 'CONFIRMAR') {
        setLoading(true);
        try {
          for (const b of bookings) await deleteDoc(b.ref);
          alert('Todas as reservas foram apagadas.');
          fetchEmployees();
        } catch (err) { console.error(err); alert('Erro ao apagar reservas.'); }
        finally { setLoading(false); }
      }
    }
  };

  const handleDeleteAllEmployees = async () => {
    if (confirm('🚨 PERIGO EXTREMO: Apagar TODAS AS ESPECIALISTAS do sistema?')) {
      const input = prompt('Digite CONFIRMAR para continuar:');
      if (input === 'CONFIRMAR') {
        setLoading(true);
        try {
          for (const emp of employees) await deleteDoc(doc(db, 'employees', emp.id));
          alert('Todas as especialistas foram apagadas.');
          fetchEmployees();
        } catch (err) { console.error(err); alert('Erro ao apagar especialistas.'); }
        finally { setLoading(false); }
      }
    }
  };

  const handleEditBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    try {
      let finalData = { ...editBookingData };
      if (editBookingData.assignedEmployeeId) {
        const sel = employees.find(emp => emp.id === editBookingData.assignedEmployeeId);
        if (sel) finalData.assignedEmployeeName = sel.name;
      }
      await updateDoc(editingBooking.ref, finalData);
      setShowEditBookingModal(false);
      setEditingBooking(null);
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  // ─── Calendar calculations ───────────────────────────────────────────────────
  const aYear = agendaDate.getFullYear();
  const aMonth = agendaDate.getMonth(); // 0-indexed
  const aMonthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const aFirstDayIndex = (new Date(aYear, aMonth, 1).getDay() + 6) % 7; // Mon=0, Sun=6
  const aDaysInMonth = new Date(aYear, aMonth + 1, 0).getDate();
  const aPrevDaysInMonth = new Date(aYear, aMonth, 0).getDate();

  const handlePrevMonth = () => {
    setAgendaDate(new Date(aYear, aMonth - 1, 1));
  };
  const handleNextMonth = () => {
    setAgendaDate(new Date(aYear, aMonth + 1, 1));
  };

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const activeEmployees  = employees.filter(e => e.active !== false && e.status === 'active');
  const pendingEmployees = employees.filter(e => e.status === 'pending');
  const today            = new Date();
  const todayISO         = today.toISOString().split('T')[0];
  const todayStr         = today.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayBookings    = bookings.filter(b => b.date === todayISO);
  const totalRevenue     = bookings.reduce((s, b) => s + (b.totalPrice || 0), 0);

  const tabTitle = (id: AdminTab) => ({
    dashboard:    'Admin Dashboard',
    agenda:       'Maestro de Agendas',
    equipe:       'Gestão de Equipe',
    recrutamento: 'Recrutamento',
    indicacoes:   'Gestão de Indicações VIP',
  }[id]);

  // ─── Login screen ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#fff7fd', fontFamily: 'Manrope, sans-serif' }}>
        <div className="silk-lift rounded-3xl p-10 max-w-sm w-full text-center mx-4">
          <div className="w-20 h-20 rounded-2xl silk-lift-sm mx-auto mb-6 flex items-center justify-center" style={{ background: '#561668' }}>
            <span className="material-symbols-outlined text-white text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>shield_person</span>
          </div>
          <h1 className="font-display italic text-3xl font-semibold text-[#561668] mb-2 tracking-tight">Painel Administrativo</h1>
          <p className="text-sm text-[#80737f] mb-8">Acesso restrito à gerência do Método Pame.</p>
          <button
            onClick={signInWithGoogle}
            className="w-full py-4 text-white rounded-2xl font-bold uppercase tracking-widest text-xs silk-lift transition-opacity hover:opacity-90"
            style={{ background: '#561668' }}
          >
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: '#fff7fd', fontFamily: 'Manrope, sans-serif', color: '#1e1a20' }}>

      {/* ══════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════ */}
      <nav
        className="h-screen w-64 fixed left-0 top-0 flex flex-col py-8 px-4 z-50"
        style={{ background: '#faf1fa', boxShadow: '4px 0 24px rgba(226,217,230,1)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-12 h-12 rounded-xl border border-[#efe5ee] flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn" 
              alt="Logo Método Pame" 
              className="w-9 h-9 object-cover" 
            />
          </div>
          <div>
            <h1 className="font-display italic text-lg font-semibold text-[#561668] leading-tight">Método Pame</h1>
            <p className="text-[9px] text-[#80737f] uppercase tracking-widest font-bold">Residential Excellence</p>
          </div>
        </div>

        {/* Nav items */}
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
              <span className="material-symbols-outlined text-[22px] flex-shrink-0">{item.icon}</span>
              <span className="text-[14px]">{item.label}</span>
              {item.id === 'recrutamento' && pendingEmployees.length > 0 && (
                <span className="ml-auto bg-[#561668] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                  {pendingEmployees.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* New Service Request */}
        <button className="mt-4 mb-8 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 silk-lift hover:opacity-90 transition-all text-sm" style={{ background: '#561668' }}>
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          Nova Solicitação
        </button>

        {/* Bottom links */}
        <div className="flex flex-col gap-1 pt-5 border-t border-[#e9e0e8]">
          <a className="flex items-center gap-3 px-4 py-2 text-[#d1c2d0] hover:text-[#561668] transition-all text-[11px] font-bold uppercase tracking-widest" href="#">
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Configurações
          </a>
          <a className="flex items-center gap-3 px-4 py-2 text-[#d1c2d0] hover:text-[#561668] transition-all text-[11px] font-bold uppercase tracking-widest" href="#">
            <span className="material-symbols-outlined text-[18px]">help</span>
            Ajuda
          </a>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          TOP APP BAR
      ══════════════════════════════════════════ */}
      <header
        className="fixed top-0 right-0 z-40 flex justify-between items-center h-20 px-8"
        style={{
          width: 'calc(100% - 16rem)',
          background: 'rgba(255,247,253,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(209,194,208,0.3)',
        }}
      >
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-[#561668] silk-text-glow">{tabTitle(activeTab)}</h2>
          <p className="text-[11px] text-[#80737f] font-bold uppercase tracking-widest capitalize">{todayStr}</p>
        </div>
        <div className="flex items-center gap-5">
          {/* Search */}
          <div className="silk-inset rounded-full px-4 py-2 w-52 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#80737f] text-[18px]">search</span>
            <input
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-[#d1c2d0] text-[#1e1a20]"
              placeholder="Buscar..."
              type="text"
            />
          </div>
          {/* Notifications */}
          <button className="w-10 h-10 flex items-center justify-center rounded-full silk-lift-sm text-[#561668] hover:bg-[#efe5ee] transition-all relative">
            <span className="material-symbols-outlined">notifications</span>
            {pendingEmployees.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 text-white text-[9px] rounded-full flex items-center justify-center font-bold" style={{ background: '#ba1a1a' }}>
                {pendingEmployees.length}
              </span>
            )}
          </button>
          {/* User */}
          <div className="flex items-center gap-3 border-l border-[#e9e0e8] pl-5">
            <div className="text-right">
              <p className="text-sm font-bold text-[#1e1a20] leading-tight">{user.displayName || 'Admin Pame'}</p>
              <p className="text-[10px] text-[#d1c2d0] uppercase tracking-wider font-bold">Diretora</p>
            </div>
            <img
              className="w-10 h-10 rounded-full object-cover silk-lift-sm border-2 border-white"
              src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'Admin')}&background=561668&color=fff`}
              alt="Admin"
            />
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════ */}
      <main className="ml-64 flex-1 pt-28 pb-16 px-8 min-h-screen">

        {/* ╔══════════════════════════════╗
            ║   TAB: DASHBOARD             ║
            ╚══════════════════════════════╝ */}
        {activeTab === 'dashboard' && (
          <div>
            {/* KPI Bento Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
              {/* Revenue */}
              <div className="silk-lift rounded-[2rem] p-7 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300">
                <div className="flex justify-between items-start">
                  <div className="p-3 rounded-2xl" style={{ background: '#703081' }}>
                    <span className="material-symbols-outlined text-[#eca1fb] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                  </div>
                  <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">+12.5%</span>
                </div>
                <div className="mt-5">
                  <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest mb-1">Receita Mensal</p>
                  <h3 className="text-[36px] font-extrabold text-[#561668] leading-none">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </h3>
                </div>
              </div>

              {/* Total Services */}
              <div className="silk-lift rounded-[2rem] p-7 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300">
                <div className="flex justify-between items-start">
                  <div className="p-3 rounded-2xl bg-[#e9e0e8]">
                    <span className="material-symbols-outlined text-[#561668] text-[28px]">task_alt</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#561668] bg-[#fcd7ff] px-2 py-1 rounded-lg">{todayBookings.length} Hoje</span>
                </div>
                <div className="mt-5">
                  <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest mb-1">Serviços Totais</p>
                  <h3 className="text-[36px] font-extrabold text-[#561668] leading-none">{bookings.length}</h3>
                </div>
              </div>

              {/* Satisfaction */}
              <div className="silk-lift rounded-[2rem] p-7 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300">
                <div className="flex justify-between items-start">
                  <div className="p-3 rounded-2xl bg-[#e9e0e8]">
                    <span className="material-symbols-outlined text-[#561668] text-[28px]">stars</span>
                  </div>
                  <div className="flex gap-0.5">
                    {[1,2,3].map(i => (
                      <span key={i} className="material-symbols-outlined text-[#561668] text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest mb-1">Satisfação do Cliente</p>
                  <h3 className="text-[36px] font-extrabold text-[#561668] leading-none">4.92</h3>
                </div>
              </div>

              {/* Active Specialists */}
              <div className="silk-lift rounded-[2rem] p-7 flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300">
                <div className="flex justify-between items-start">
                  <div className="p-3 rounded-2xl bg-[#e9e0e8]">
                    <span className="material-symbols-outlined text-[#561668] text-[28px]">group</span>
                  </div>
                  <span className="flex h-3 w-3 bg-green-500 rounded-full animate-pulse"></span>
                </div>
                <div className="mt-5">
                  <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest mb-1">Especialistas Ativas</p>
                  <div className="flex items-end gap-2">
                    <h3 className="text-[36px] font-extrabold text-[#561668] leading-none">{activeEmployees.length}</h3>
                    <p className="text-base text-[#80737f] mb-1">/ {employees.filter(e => e.active !== false).length}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Trend Chart + Critical Services */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
              {/* Trend Chart */}
              <div className="lg:col-span-2 silk-lift rounded-[2rem] p-9 flex flex-col" style={{ minHeight: 400 }}>
                <div className="flex justify-between items-center mb-7">
                  <div>
                    <h3 className="text-lg font-bold text-[#561668]">Tendência de Serviços</h3>
                    <p className="text-sm text-[#80737f]">Análise de rendimento semestral</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 rounded-xl silk-inset text-[11px] text-[#561668] font-bold tracking-widest">SEMANAL</button>
                    <button className="px-4 py-2 rounded-xl text-[11px] text-[#80737f] font-bold hover:text-[#561668] transition-colors tracking-widest">MENSAL</button>
                  </div>
                </div>
                <div className="flex-grow flex items-end justify-between gap-4 px-4 pb-4">
                  {[
                    { label: 'JAN', fill: '60%', outer: '65%', alt: false },
                    { label: 'FEV', fill: '75%', outer: '78%', alt: true  },
                    { label: 'MAR', fill: '65%', outer: '70%', alt: false },
                    { label: 'ABR', fill: '87%', outer: '90%', alt: true  },
                    { label: 'MAI', fill: '78%', outer: '82%', alt: false },
                    { label: 'JUN', fill: '92%', outer: '96%', alt: true  },
                  ].map(bar => (
                    <div key={bar.label} className="flex flex-col items-center gap-3 w-full">
                      <div className="w-full rounded-t-full relative silk-inset" style={{ height: bar.outer }}>
                        <div
                          className="absolute bottom-0 w-full rounded-t-full progress-glow transition-all duration-700"
                          style={{ height: bar.fill, background: bar.alt ? '#703081' : '#561668' }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-[#80737f] tracking-widest">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical Services */}
              <div className="silk-lift rounded-[2rem] p-9 flex flex-col overflow-y-auto" style={{ maxHeight: 400 }}>
                <div className="flex items-center gap-3 mb-7">
                  <span className="material-symbols-outlined text-[#ba1a1a]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  <h3 className="text-lg font-bold text-[#561668]">Serviços Críticos</h3>
                </div>
                <div className="flex flex-col gap-4 flex-grow">
                  {bookings.filter(b => !b.assignedEmployeeId).slice(0, 3).map((b, i) => (
                    <div key={i} className="p-5 rounded-2xl silk-inset border-l-4 border-[#ba1a1a] flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold bg-[#ffdad6] text-[#93000a] px-2 py-0.5 rounded-full uppercase tracking-widest">Sem Atribuir</span>
                        <span className="text-[11px] text-[#80737f]">{b.date}</span>
                      </div>
                      <h4 className="text-sm font-bold text-[#561668]">{b.name || 'Cliente'}</h4>
                      <p className="text-[11px] text-[#80737f]">{b.format === 'meio' ? 'Meio Turno' : 'Turno Completo'}</p>
                      <button onClick={() => setActiveTab('agenda')} className="text-[11px] font-bold text-[#561668] underline text-left">Ver na Agenda →</button>
                    </div>
                  ))}
                  {bookings.filter(b => !b.assignedEmployeeId).length === 0 && (
                    <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
                      <span className="material-symbols-outlined text-5xl text-[#d1c2d0] mb-3">check_circle</span>
                      <p className="text-sm text-[#80737f]">Todos os serviços estão atribuídos.</p>
                    </div>
                  )}
                  {pendingEmployees.length > 0 && (
                    <div className="p-5 rounded-2xl silk-inset border-l-4 border-[#561668] flex flex-col gap-2">
                      <span className="text-[10px] font-bold bg-[#e9e0e8] text-[#561668] px-2 py-0.5 rounded-full uppercase tracking-widest w-fit">Recrutamento</span>
                      <h4 className="text-sm font-bold text-[#561668]">{pendingEmployees.length} candidatura(s) pendente(s)</h4>
                      <button onClick={() => setActiveTab('recrutamento')} className="text-[11px] font-bold text-[#561668] underline text-left">Revisar →</button>
                    </div>
                  )}
                </div>
                <button className="mt-4 w-full text-center text-sm font-bold text-[#80737f] hover:text-[#561668] transition-all pt-4 border-t border-[#e9e0e8]" onClick={() => setActiveTab('agenda')}>
                  Ver todos os agendamentos →
                </button>
              </div>
            </div>

            {/* Specialist Status + Feedback */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Specialists */}
              <div className="silk-lift rounded-[2rem] p-9">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-lg font-bold text-[#561668]">Estado das Especialistas</h3>
                  <button onClick={() => setActiveTab('equipe')} className="silk-lift-sm px-4 py-2 rounded-xl text-[11px] font-bold text-[#561668] tracking-widest uppercase">Lista Completa</button>
                </div>
                <div className="flex flex-col gap-5">
                  {activeEmployees.slice(0, 3).length > 0 ? activeEmployees.slice(0, 3).map(emp => (
                    <div key={emp.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <img className="w-11 h-11 rounded-full object-cover silk-lift-sm" src={emp.photoURL} alt={emp.name} />
                        <div>
                          <h4 className="text-sm font-bold text-[#1e1a20] leading-tight">{emp.name}</h4>
                          <p className="text-[11px] text-[#80737f]">{emp.role} · {bookings.filter(b => b.assignedEmployeeId === emp.id).length} serviços</p>
                        </div>
                      </div>
                      <span className="text-green-600 font-bold text-[10px] bg-green-50 px-2 py-1 rounded-full uppercase tracking-widest">Ativa</span>
                    </div>
                  )) : (
                    <p className="text-sm text-[#80737f] text-center py-8">Nenhuma especialista ativa cadastrada.</p>
                  )}
                </div>
              </div>

              {/* Feedback */}
              <div className="silk-lift rounded-[2rem] p-9 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl" style={{ background: 'rgba(86,22,104,0.05)' }} />
                <h3 className="text-lg font-bold text-[#561668] mb-8">Feedback Recente</h3>
                <div className="flex flex-col gap-5">
                  {[
                    { text: '"O Método Pame realmente se nota em cada detalhe. Totalmente recomendado."', who: 'Residência Alarcón', stars: 5 },
                    { text: '"Excelente pontualidade e profissionalismo. O sistema de gestão é muito eficiente."', who: 'Grupo Imobiliário V&M', stars: 5 },
                  ].map((rev, i) => (
                    <div key={i} className="silk-inset p-5 rounded-2xl relative">
                      <div className="absolute -top-3 -left-2 text-[#561668]/10">
                        <span className="material-symbols-outlined text-[48px]">format_quote</span>
                      </div>
                      <p className="text-sm italic text-[#4e434e] mb-3 relative z-10">{rev.text}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-[#561668]">{rev.who}</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: rev.stars }).map((_, j) => (
                            <span key={j} className="material-symbols-outlined text-[#561668] text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║   TAB: AGENDA                ║
            ╚══════════════════════════════╝ */}
        {activeTab === 'agenda' && (
          <div>
            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex p-1 bg-[#f4ebf4] rounded-2xl silk-inset w-fit">
                <button
                  onClick={() => setAgendaView('lista')}
                  className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
                    agendaView === 'lista'
                      ? 'bg-white text-[#561668] silk-lift'
                      : 'text-[#80737f] hover:text-[#561668]'
                  }`}
                >
                  Vista de Lista
                </button>
                <button
                  onClick={() => setAgendaView('calendario')}
                  className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
                    agendaView === 'calendario'
                      ? 'bg-white text-[#561668] silk-lift'
                      : 'text-[#80737f] hover:text-[#561668]'
                  }`}
                >
                  Calendário
                </button>
              </div>

              <div className="flex items-center gap-3">
                {agendaView === 'calendario' && (
                  <div className="flex items-center gap-2 bg-[#faf1fa] p-1 rounded-xl border border-[#efe5ee]/60">
                    <button
                      onClick={handlePrevMonth}
                      className="w-8 h-8 rounded-lg hover:bg-white text-[#561668] flex items-center justify-center cursor-pointer shadow-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <span className="text-xs font-bold text-[#561668] min-w-[90px] text-center">
                      {aMonthNames[aMonth]} {aYear}
                    </span>
                    <button
                      onClick={handleNextMonth}
                      className="w-8 h-8 rounded-lg hover:bg-white text-[#561668] flex items-center justify-center cursor-pointer shadow-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                )}
                <button
                  onClick={fetchEmployees}
                  className="flex items-center gap-2 px-4 py-2 silk-lift rounded-xl text-[#561668] font-bold text-sm hover:opacity-80 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span> Atualizar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-8">
              {/* Bookings List / Calendar Container */}
              <div className="col-span-12 lg:col-span-8 silk-lift rounded-[2rem] p-8">
                {loading ? (
                  <>
                    <div className="flex justify-between items-center mb-7">
                      <div>
                        <h3 className="text-lg font-bold text-[#561668]">Serviços Agendados</h3>
                      </div>
                    </div>
                    <div className="text-center py-16 text-[#80737f]">Carregando agendamentos...</div>
                  </>
                ) : agendaView === 'lista' ? (
                  <>
                    <div className="flex justify-between items-center mb-7">
                      <div>
                        <h3 className="text-lg font-bold text-[#561668]">Serviços Agendados</h3>
                        <p className="text-sm text-[#80737f]">{bookings.length} agendamento(s) no total</p>
                      </div>
                    </div>

                    {bookings.length === 0 ? (
                      <div className="text-center py-16 flex flex-col items-center">
                        <span className="material-symbols-outlined text-5xl text-[#d1c2d0] mb-3">calendar_today</span>
                        <p className="text-[#80737f]">Nenhum agendamento encontrado.</p>
                        <p className="text-sm text-[#d1c2d0] mt-1">Pode requerer configuração de índice no Firestore.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {bookings.map((b, i) => {
                          const assignedEmp = employees.find(e => e.id === b.assignedEmployeeId);
                          const statusStyles =
                            b.status === 'Concluído' ? 'bg-green-50 text-green-700' :
                            b.status === 'Cancelado' ? 'bg-red-50 text-red-600' :
                            'bg-[#e9e0e8] text-[#561668]';
                          const statusDot =
                            b.status === 'Concluído' ? 'bg-green-500' :
                            b.status === 'Cancelado' ? 'bg-red-500' :
                            'bg-[#561668] animate-pulse';

                          return (
                            <div
                              key={b.docId || i}
                              className={`flex items-center gap-5 p-5 rounded-2xl transition-transform duration-200 hover:scale-[1.005] ${
                                b.assignedEmployeeId ? 'silk-active border-l-4 border-[#561668]' : 'silk-lift'
                              }`}
                            >
                              {/* Time */}
                              <div className="w-20 text-center flex-shrink-0">
                                <span className="block text-base font-bold text-[#561668]">{b.time || '—'}</span>
                                <span className="text-[10px] text-[#80737f] font-bold uppercase">{b.date}</span>
                              </div>
                              {/* Info */}
                              <div className="flex-1 border-l border-[#e9e0e8] pl-5 min-w-0">
                                <h4 className="font-bold text-[#1e1a20] text-sm truncate">{b.name || 'Cliente'}</h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  <div className="flex items-center gap-1 text-[10px] bg-[#f4ebf4] rounded-full px-2 py-1 text-[#626264] font-bold">
                                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                                    {b.format === 'meio' ? 'Meio Turno' : 'Turno Completo'}
                                  </div>
                                  {b.totalPrice > 0 && (
                                    <div className="text-[10px] bg-[#fcd7ff] text-[#561668] rounded-full px-2 py-1 font-bold">
                                      R$ {b.totalPrice}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Specialist */}
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                {assignedEmp ? (
                                  <>
                                    <img className="w-9 h-9 rounded-full silk-lift-sm border-2 border-white" src={assignedEmp.photoURL} alt={assignedEmp.name} />
                                    <span className="text-[10px] text-[#80737f] font-bold text-right max-w-[80px] truncate">{assignedEmp.name}</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="w-9 h-9 rounded-full bg-[#f4ebf4] silk-lift border-2 border-white flex items-center justify-center">
                                      <span className="material-symbols-outlined text-[#80737f] text-[16px]">person_add</span>
                                    </div>
                                    <span className="text-[10px] text-[#561668] font-bold">Sem atribuir</span>
                                  </>
                                )}
                              </div>
                              {/* Status */}
                              <div className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 flex-shrink-0 ${statusStyles}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                                {b.status || 'Confirmado'}
                              </div>
                              {/* Actions */}
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingBooking(b);
                                    setEditBookingData({ name: b.name || '', date: b.date || '', time: b.time || '09:00', format: b.format || 'meio', status: b.status || 'Confirmado', assignedEmployeeId: b.assignedEmployeeId || '', totalPrice: b.totalPrice || 0 });
                                    setShowEditBookingModal(true);
                                  }}
                                  className="text-[#561668] font-bold text-[10px] uppercase tracking-widest hover:underline"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteBooking(b.ref)}
                                  className="text-[#ba1a1a] font-bold text-[10px] uppercase tracking-widest hover:underline border-l border-[#e9e0e8] pl-2"
                                >
                                  Deletar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-7">
                      <div>
                        <h3 className="text-lg font-bold text-[#561668]">Calendário de Serviços</h3>
                        <p className="text-sm text-[#80737f]">Visualização mensal dos agendamentos</p>
                      </div>
                    </div>

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
                      {Array.from({ length: aFirstDayIndex }).map((_, i) => {
                        const dayNum = aPrevDaysInMonth - aFirstDayIndex + 1 + i;
                        return (
                          <div key={`prev-${i}`} className="min-h-[100px] rounded-xl flex items-start p-1.5 opacity-20 text-[11px] font-semibold bg-[#faf1fa]/20 border border-transparent select-none">
                            {dayNum}
                          </div>
                        );
                      })}

                      {/* Current Month Days */}
                      {Array.from({ length: aDaysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dayStr = `${aYear}-${String(aMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayBookings = bookings.filter(b => b.date === dayStr);

                        return (
                          <div
                            key={`day-${day}`}
                            className={`min-h-[100px] rounded-xl flex flex-col p-1.5 text-left text-[11px] font-bold border transition-all ${
                              dayBookings.length > 0
                                ? 'bg-[#f4ebf4]/30 border-[#561668]/15'
                                : 'bg-[#faf1fa]/40 border-transparent hover:bg-[#faf1fa]'
                            }`}
                          >
                            <span className="text-[#80737f]">{day}</span>
                            <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-[80px] no-scrollbar">
                              {dayBookings.slice(0, 3).map((b, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBooking(b);
                                    setEditBookingData({
                                      name: b.name || '',
                                      date: b.date || '',
                                      time: b.time || '09:00',
                                      format: b.format || 'meio',
                                      status: b.status || 'Confirmado',
                                      assignedEmployeeId: b.assignedEmployeeId || '',
                                      totalPrice: b.totalPrice || 0
                                    });
                                    setShowEditBookingModal(true);
                                  }}
                                  className={`w-full text-[9px] px-1 py-0.5 rounded text-left truncate block font-bold transition-all hover:scale-[1.02] ${
                                    b.assignedEmployeeId
                                      ? 'bg-[#561668] text-white hover:opacity-95'
                                      : 'bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/20 hover:bg-[#ffcdd2]'
                                  }`}
                                  title={`${b.time || '—'} - ${b.name}`}
                                >
                                  {b.time || '—'} {b.name}
                                </button>
                              ))}
                              {dayBookings.length > 3 && (
                                <div className="text-[8px] text-[#80737f] text-right font-bold mt-0.5">
                                  +{dayBookings.length - 3} mais
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Right Sidebar */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                {/* Productivity Card */}
                <div className="rounded-[2rem] p-7 text-white relative overflow-hidden" style={{ background: '#561668' }}>
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="material-symbols-outlined text-[80px]">analytics</span>
                  </div>
                  <h3 className="text-base font-bold mb-5 relative z-10">Produtividade</h3>
                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                      <span className="text-[10px] opacity-80 uppercase tracking-widest font-bold block mb-1">Concluídos</span>
                      <div className="text-2xl font-extrabold">{bookings.filter(b => b.status === 'Concluído').length}</div>
                    </div>
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                      <span className="text-[10px] opacity-80 uppercase tracking-widest font-bold block mb-1">Pendentes</span>
                      <div className="text-2xl font-extrabold">{bookings.filter(b => !b.assignedEmployeeId).length}</div>
                    </div>
                  </div>
                  <div className="mt-6 relative z-10">
                    <div className="flex justify-between text-[10px] font-bold mb-2 opacity-80 uppercase tracking-widest">
                      <span>Progresso</span>
                      <span>
                        {bookings.length > 0
                          ? Math.round((bookings.filter(b => b.status === 'Concluído').length / bookings.length) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <div
                        className="h-full bg-white rounded-full transition-all duration-700"
                        style={{ width: `${bookings.length > 0 ? Math.round((bookings.filter(b => b.status === 'Concluído').length / bookings.length) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Available Specialists */}
                <div className="silk-lift rounded-[2rem] p-7">
                  <h3 className="text-base font-bold text-[#561668] mb-5">Especialistas Disponíveis</h3>
                  <div className="flex flex-col gap-3">
                    {activeEmployees.slice(0, 5).length > 0 ? activeEmployees.slice(0, 5).map(emp => (
                      <div key={emp.id} className="flex items-center justify-between p-4 silk-inset rounded-2xl">
                        <div className="flex items-center gap-3">
                          <img className="w-9 h-9 rounded-full" src={emp.photoURL} alt={emp.name} />
                          <div>
                            <p className="font-bold text-[#1e1a20] text-sm leading-tight">{emp.name}</p>
                            <p className="text-[10px] text-[#80737f]">{emp.role}</p>
                          </div>
                        </div>
                        <button className="text-[#561668] font-bold text-[11px] hover:underline uppercase tracking-widest">Atribuir</button>
                      </div>
                    )) : (
                      <p className="text-sm text-[#80737f] text-center py-6">Nenhuma especialista ativa.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║   TAB: EQUIPE                ║
            ╚══════════════════════════════╝ */}
        {activeTab === 'equipe' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-extrabold text-[#561668]">Especialistas</h2>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest silk-lift hover:opacity-90 transition-opacity"
                style={{ background: '#561668' }}
              >
                + Nova Especialista
              </button>
            </div>

            {loading ? (
              <div className="silk-lift rounded-3xl p-12 text-center text-[#80737f]">Carregando base de dados...</div>
            ) : employees.filter(e => e.active !== false && e.status !== 'pending').length === 0 ? (
              <div className="silk-lift rounded-3xl p-12 text-center flex flex-col items-center">
                <span className="material-symbols-outlined text-5xl text-[#d1c2d0] mb-3">group_off</span>
                <p className="text-[#80737f]">Nenhuma especialista cadastrada ou ativa ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {employees.filter(e => e.active !== false && e.status !== 'pending').map(emp => (
                  <div key={emp.id} className="silk-lift rounded-3xl p-6 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-[#e9e0e8]/50 pb-4">
                      <div className="flex gap-4 items-center">
                        <img src={emp.photoURL} alt={emp.name} className="w-14 h-14 rounded-full border-2 border-white silk-lift-sm" />
                        <div>
                          <h3 className="font-extrabold text-lg text-[#1e1a20] leading-tight">{emp.name}</h3>
                          <p className="text-[10px] text-[#80737f] font-bold uppercase tracking-widest">{emp.role}</p>
                          {emp.whatsapp && <p className="text-[11px] text-[#4e434e] mt-0.5">📱 {emp.whatsapp}</p>}
                          {emp.zones && <p className="text-[11px] text-[#4e434e]">📍 {emp.zones}</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[9px] text-[#80737f] uppercase tracking-widest font-bold">Carga (Mês)</p>
                        <p className="font-black text-2xl text-[#561668]">{emp.assignedServices}</p>
                      </div>
                    </div>

                    {/* Availability */}
                    <div>
                      <h4 className="text-sm font-bold text-[#561668] mb-3">Disponibilidade Semanal</h4>
                      <div className="overflow-x-auto silk-inset rounded-2xl">
                        <table className="w-full text-[10px] text-center font-bold">
                          <thead className="text-[#80737f] uppercase tracking-widest border-b border-[#e9e0e8]">
                            <tr>
                              <th className="p-2 border-r border-[#e9e0e8] text-left">Dia</th>
                              {SHIFTS.map(s => <th key={s.id} className="p-2">{s.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {DAYS_OF_WEEK.map((dayName, idx) => (
                              <tr key={dayName} className="border-b border-[#e9e0e8] last:border-0 hover:bg-[#faf1fa]/30 transition-colors">
                                <td className="p-2 border-r border-[#e9e0e8] text-left text-[#561668] uppercase tracking-widest bg-[#faf1fa]/50 w-20">{dayName.slice(0, 3)}</td>
                                {SHIFTS.map(shift => {
                                  const isSelected = emp.weeklyAvailability?.[idx]?.includes(shift.id as any);
                                  return (
                                    <td key={shift.id} className="p-1">
                                      <button
                                        onClick={() => toggleAvailability(emp.id, idx, shift.id, emp.weeklyAvailability || {})}
                                        className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-all ${
                                          isSelected
                                            ? 'text-white'
                                            : 'border border-[#d1c2d0] text-transparent hover:border-[#561668]/50'
                                        }`}
                                        style={isSelected ? { background: '#561668' } : {}}
                                      >
                                        {isSelected && <span className="material-symbols-outlined text-[12px]">check</span>}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Recent Services */}
                    <div className="border-t border-[#e9e0e8]/50 pt-4">
                      <h4 className="text-sm font-bold text-[#561668] mb-2">Últimos Serviços Atendidos</h4>
                      <div className="flex flex-col gap-1.5">
                        {bookings.filter(b => b.assignedEmployeeId === emp.id).slice(0, 3).map((b, i) => (
                          <div key={i} className="text-[11px] flex justify-between items-center silk-inset p-2 rounded-xl">
                            <span className="font-semibold text-[#1e1a20]">{b.name}</span>
                            <span className="text-[#80737f]">{b.date} · {b.format === 'meio' ? 'Meio Turno' : 'Integral'}</span>
                          </div>
                        ))}
                        {bookings.filter(b => b.assignedEmployeeId === emp.id).length === 0 && (
                          <span className="text-[11px] text-[#80737f] italic">Nenhum serviço registrado ainda.</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-[#e9e0e8]/50 flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingEmployee(emp);
                          setEditFormData({ name: emp.name, role: emp.role, cpf: emp.cpf || '', whatsapp: emp.whatsapp || '', email: emp.email || '', zones: emp.zones || '' });
                          setShowEditModal(true);
                        }}
                        className="w-9 h-9 rounded-full bg-[#f4ebf4] text-[#561668] flex items-center justify-center hover:bg-[#e9e0e8] transition-colors"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp.id)}
                        className="w-9 h-9 rounded-full bg-[#f4ebf4] text-[#ba1a1a] flex items-center justify-center hover:bg-[#ffdad6] transition-colors"
                        title="Desativar"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                      </button>
                      <button
                        onClick={() => handleHardDeleteEmployee(emp.id)}
                        className="w-9 h-9 rounded-full bg-[#ffdad6] text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors"
                        title="Deletar permanentemente"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Danger Zone */}
            <div className="mt-12 rounded-3xl p-7 border border-red-200 bg-red-50">
              <h2 className="text-lg font-extrabold text-red-700 mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined">warning</span> Danger Zone
              </h2>
              <p className="text-red-900/70 text-sm mb-6">Ações irreversíveis. Afetam o banco de dados de produção diretamente. Tenha cuidado extremo.</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={handleDeleteAllBookings} className="bg-red-600 hover:bg-red-700 transition-colors text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span> Apagar TODAS as Reservas
                </button>
                <button onClick={handleDeleteAllEmployees} className="bg-red-600 hover:bg-red-700 transition-colors text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">group_remove</span> Apagar TODAS as Especialistas
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║   TAB: RECRUTAMENTO          ║
            ╚══════════════════════════════╝ */}
        {activeTab === 'recrutamento' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-extrabold text-[#561668]">
                Candidaturas Pendentes
                {pendingEmployees.length > 0 && (
                  <span className="ml-3 text-white text-xs px-2.5 py-1 rounded-full font-bold align-middle" style={{ background: '#561668' }}>
                    {pendingEmployees.length}
                  </span>
                )}
              </h2>
            </div>

            {loading ? (
              <div className="silk-lift rounded-3xl p-12 text-center text-[#80737f]">Carregando candidaturas...</div>
            ) : pendingEmployees.length === 0 ? (
              <div className="silk-lift rounded-3xl p-16 text-center flex flex-col items-center">
                <span className="material-symbols-outlined text-6xl text-[#d1c2d0] mb-4">inbox</span>
                <h3 className="text-lg font-bold text-[#561668] mb-2">Nenhuma candidatura pendente</h3>
                <p className="text-[#80737f] text-sm">Todas as candidaturas foram revisadas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {pendingEmployees.map(emp => (
                  <div key={emp.id} className="silk-lift rounded-3xl p-7 flex flex-col gap-5">
                    {/* Candidate Header */}
                    <div className="flex gap-4 items-center">
                      <img src={emp.photoURL} alt={emp.name} className="w-16 h-16 rounded-full silk-lift-sm border-2 border-white" />
                      <div>
                        <h3 className="font-extrabold text-lg text-[#1e1a20] leading-tight">{emp.name}</h3>
                        <span className="text-[10px] text-yellow-700 font-bold uppercase tracking-widest bg-yellow-100 px-2 py-0.5 rounded-full">
                          Aguardando Avaliação
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="silk-inset p-4 rounded-2xl flex flex-col gap-2 text-sm">
                      <p><span className="font-bold text-[#561668]">CPF:</span> <span className="text-[#4e434e]">{emp.cpf || 'Não informado'}</span></p>
                      <p><span className="font-bold text-[#561668]">WhatsApp:</span> <span className="text-[#4e434e]">{emp.whatsapp || 'Não informado'}</span></p>
                      {emp.zones && <p><span className="font-bold text-[#561668]">Zonas:</span> <span className="text-[#4e434e]">{emp.zones}</span></p>}
                    </div>

                    {/* Café Virtual */}
                    <div className="silk-inset p-4 rounded-2xl text-center">
                      <span className="material-symbols-outlined text-[#561668] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>coffee</span>
                      <p className="text-xs font-bold text-[#561668] mt-1">Café Virtual com a Pame</p>
                      <p className="text-[10px] text-[#80737f] mt-1">Agendar conversa de seleção</p>
                      <button className="mt-3 w-full py-2 text-[11px] font-bold text-[#561668] border border-[#d1c2d0] rounded-xl hover:bg-[#f4ebf4] transition-colors uppercase tracking-widest">
                        Agendar Café ☕
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 mt-auto">
                      <button
                        onClick={() => handleRejectCandidate(emp.id)}
                        className="flex-1 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors border border-red-200"
                      >
                        Rejeitar
                      </button>
                      <button
                        onClick={() => handleApproveCandidate(emp.id)}
                        className="flex-1 py-3 text-white hover:opacity-90 rounded-xl text-xs font-bold uppercase tracking-widest transition-opacity silk-lift"
                        style={{ background: '#561668' }}
                      >
                        Aprovar ✓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║   TAB: INDICAÇÕES            ║
            ╚══════════════════════════════╝ */}
        {activeTab === 'indicacoes' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-display italic text-3xl font-semibold text-[#561668]">
                Círculo de Excelência (Indicações VIP)
              </h2>
            </div>

            {/* Statistics Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total referrals */}
              <div className="silk-lift rounded-3xl p-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-wider">Total de Indicações</p>
                  <h3 className="text-3xl font-extrabold text-[#561668] mt-1.5">{referrals.length}</h3>
                  <p className="text-[10px] text-[#80737f] mt-0.5">Registradas no sistema</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[#561668]/10 text-[#561668] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">group</span>
                </div>
              </div>

              {/* Pending Completion */}
              <div className="silk-lift rounded-3xl p-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-wider">Aguardando Conclusão</p>
                  <h3 className="text-3xl font-extrabold text-amber-600 mt-1.5">
                    {referrals.filter(r => r.status === 'pending').length}
                  </h3>
                  <p className="text-[10px] text-[#80737f] mt-0.5">Amigos com plano ativo</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">hourglass_empty</span>
                </div>
              </div>

              {/* Free Cleanings Available */}
              <div className="silk-lift rounded-3xl p-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-wider">Cortesias Liberadas</p>
                  <h3 className="text-3xl font-extrabold text-green-600 mt-1.5">
                    {referrals.filter(r => r.status === 'completed').length}
                  </h3>
                  <p className="text-[10px] text-[#80737f] mt-0.5">Aguardando agendamento</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">stars</span>
                </div>
              </div>

              {/* Free Cleanings Claimed */}
              <div className="silk-lift rounded-3xl p-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#80737f] uppercase tracking-wider">Cortesias Usufruídas</p>
                  <h3 className="text-3xl font-extrabold text-[#703081] mt-1.5">
                    {referrals.filter(r => r.status === 'rewarded').length}
                  </h3>
                  <p className="text-[10px] text-[#80737f] mt-0.5">Serviços entregues</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[#703081]/10 text-[#703081] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">check_circle</span>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="silk-lift rounded-3xl p-12 text-center text-[#80737f] animate-pulse-silk">Carregando indicações...</div>
            ) : referrals.length === 0 ? (
              <div className="silk-lift rounded-3xl p-16 text-center flex flex-col items-center">
                <span className="material-symbols-outlined text-6xl text-[#d1c2d0] mb-4">stars</span>
                <h3 className="font-display italic text-2xl font-semibold text-[#561668] mb-2">Nenhuma indicação ainda</h3>
                <p className="text-[#80737f] text-sm">Quando os clientes recomendarem o método, eles aparecerão aqui.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <div className="overflow-x-auto silk-lift rounded-[2rem] p-8 border border-white/60">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#efe5ee]/40 text-[#80737f] uppercase font-bold tracking-wider text-[10px] pb-3">
                        <th className="pb-3 text-left">Quem Indicou (Referente)</th>
                        <th className="pb-3 text-left">Amigo (Referido)</th>
                        <th className="pb-3 text-center">Status</th>
                        <th className="pb-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((ref) => {
                        const statusColors = 
                          ref.status === 'rewarded' ? 'bg-[#561668]/15 text-[#561668]' :
                          ref.status === 'completed' ? 'bg-green-50 text-green-700' :
                          'bg-yellow-50 text-yellow-700';
                        
                        const statusLabel = 
                          ref.status === 'rewarded' ? 'Cortesia Entregue' :
                          ref.status === 'completed' ? 'Cortesia Liberada' :
                          'Pendente Mensalidade';

                        return (
                          <tr key={ref.id} className="border-b border-[#efe5ee]/20 last:border-none hover:bg-[#faf1fa]/25 transition-colors">
                            <td className="py-4 text-left">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#561668]/10 text-[#561668] font-bold text-sm flex items-center justify-center">
                                  {ref.referrerName.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-bold text-sm text-[#1e1a20]">{ref.referrerName}</span>
                              </div>
                            </td>
                            <td className="py-4 text-left">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#703081]/10 text-[#703081] font-bold text-sm flex items-center justify-center">
                                  {ref.referredName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-sm text-[#1e1a20]">{ref.referredName}</span>
                                  <p className="text-[10px] text-[#80737f] font-normal mt-0.5">{ref.referredEmail}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider font-extrabold ${statusColors}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="py-4 text-right flex items-center justify-end gap-2">
                              {ref.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateReferral(ref.id, 'completed')}
                                  className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors active-scale cursor-pointer"
                                >
                                  Liberar Cortesia
                                </button>
                              )}
                              {ref.status === 'completed' && (
                                <button
                                  onClick={() => handleUpdateReferral(ref.id, 'rewarded')}
                                  className="px-4 py-2 bg-[#561668] text-white hover:opacity-90 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-opacity shadow-sm active-scale cursor-pointer"
                                >
                                  Marcar como Entregue
                                </button>
                              )}
                              {ref.status === 'rewarded' && (
                                <span className="text-[10px] font-bold text-[#80737f] italic px-2">Finalizado</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ╔══════════════════════════════╗
            ║   TAB: CONCIERGE / MENSAGENS  ║
            ╚══════════════════════════════╝ */}
        {activeTab === 'concierge' && (
          <div className="animate-fade-in flex flex-col h-[calc(100vh-8rem)]">
            <div className="mb-6">
              <h1 className="font-sans text-3xl font-extrabold text-[#561668] tracking-tight">Concierge / Mensagens</h1>
              <p className="text-sm text-[#4e434e] mt-1 font-medium">Bandeja de entrada do assistente virtual. Monitore os chats das suas clientas em tempo real.</p>
            </div>

            <div className="flex flex-1 gap-6 min-h-0">
              {/* Chat List Sidebar */}
              <div className="w-1/3 silk-lift rounded-3xl p-4 flex flex-col gap-3 overflow-y-auto custom-scroll">
                <h3 className="text-sm font-bold text-[#561668] px-2">Conversas Ativas</h3>
                {activeChats.length === 0 ? (
                  <div className="text-center py-8 text-sm text-[#80737f] font-semibold">Nenhuma conversa encontrada.</div>
                ) : (
                  activeChats.map(chat => (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChatId(chat.id)}
                      className={`flex flex-col gap-1 p-3 rounded-2xl text-left transition-all ${selectedChatId === chat.id ? 'bg-[#561668] text-white shadow-md' : 'bg-[#fff7fd] text-[#4e434e] hover:bg-[#faf1fa]'}`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-sm truncate pr-2">{chat.clientName}</span>
                        {chat.hasUnreadAdmin && (
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                        )}
                      </div>
                      <span className={`text-[11px] truncate opacity-80 ${selectedChatId === chat.id ? 'text-white' : 'text-[#80737f]'}`}>
                        {chat.lastMessageText || 'Nova mensagem...'}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Chat View */}
              <div className="flex-1 silk-lift rounded-3xl p-6 flex flex-col bg-[#fff7fd] min-h-0">
                {selectedChatId ? (
                  <>
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#efe5ee]">
                      <h3 className="font-bold text-[#561668]">{activeChats.find(c => c.id === selectedChatId)?.clientName}</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto mb-4 flex flex-col gap-3 pr-2 custom-scroll">
                      {selectedChatMessages.map(msg => {
                        const isUser = msg.role === 'user';
                        return (
                          <div key={msg.id} className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'ml-auto text-right items-end' : 'text-left'}`}>
                            <div className={`p-3 rounded-2xl text-sm ${isUser ? 'bg-[#faf1fa] text-[#4e434e] border border-[#efe5ee] rounded-tr-none' : 'bg-[#561668] text-white rounded-tl-none shadow-sm'}`}>
                              {msg.text}
                            </div>
                            <span className="text-[9px] text-[#80737f] px-1 font-bold uppercase tracking-wider mt-0.5">
                              {isUser ? 'Clienta' : 'Concierge AI'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[#80737f] font-semibold text-sm">
                    Selecione uma conversa para visualizar o histórico do AI Concierge.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════
          MODALS — lógica 100% preservada
      ══════════════════════════════════════════ */}

      {/* Add Employee */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#1e1a20]/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="silk-lift rounded-3xl p-8 w-full max-w-md">
            <h2 className="text-xl font-extrabold text-[#561668] mb-6">Adicionar Especialista</h2>
            <form onSubmit={handleAddEmployee} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-[#561668] uppercase tracking-widest mb-1.5">Nome Completo</label>
                <input type="text" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} className="w-full h-11 px-4 silk-inset border-none rounded-xl text-sm outline-none" required />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-[#561668] uppercase tracking-widest mb-1.5">Cargo / Função</label>
                <input type="text" value={newEmpRole} onChange={e => setNewEmpRole(e.target.value)} className="w-full h-11 px-4 silk-inset border-none rounded-xl text-sm outline-none" required />
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-[11px] font-bold uppercase tracking-widest text-[#80737f] hover:text-[#1e1a20]">Cancelar</button>
                <button type="submit" className="flex-1 py-3 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest silk-lift hover:opacity-90" style={{ background: '#561668' }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee */}
      {showEditModal && editingEmployee && (
        <div className="fixed inset-0 bg-[#1e1a20]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="silk-lift rounded-3xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 text-white text-center" style={{ background: '#561668' }}>
              <h3 className="font-extrabold text-xl">Editar Especialista</h3>
            </div>
            <form onSubmit={handleEditEmployee} className="p-6 flex flex-col gap-4">
              {[
                { label: 'Nome Completo',            key: 'name',     type: 'text',  req: true  },
                { label: 'Cargo',                    key: 'role',     type: 'text',  req: true  },
                { label: 'CPF',                      key: 'cpf',      type: 'text',  req: false },
                { label: 'WhatsApp',                 key: 'whatsapp', type: 'text',  req: false },
                { label: 'Email (Para Notificações)', key: 'email',   type: 'email', req: false },
                { label: 'Zonas de Atendimento',     key: 'zones',    type: 'text',  req: false },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-bold text-[#561668] uppercase tracking-widest mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    required={f.req}
                    value={(editFormData as any)[f.key] || ''}
                    onChange={e => setEditFormData({ ...editFormData, [f.key]: e.target.value })}
                    className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 text-sm outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  />
                </div>
              ))}
              <div className="flex gap-3 mt-4 pt-4 border-t border-[#efe5ee]">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 text-[#80737f] font-bold text-[11px] uppercase tracking-widest hover:bg-[#f8f9fa] rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-3 text-white font-bold text-[11px] uppercase tracking-widest rounded-xl hover:opacity-90" style={{ background: '#561668' }}>Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Booking */}
      {showEditBookingModal && editingBooking && (
        <div className="fixed inset-0 bg-[#1e1a20]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="silk-lift rounded-3xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 text-white text-center" style={{ background: '#561668' }}>
              <h3 className="font-extrabold text-xl">Editar Agendamento</h3>
              <p className="text-[11px] opacity-70 mt-1">Modo Deus</p>
            </div>
            <form onSubmit={handleEditBooking} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#561668] uppercase tracking-widest mb-1.5">Cliente</label>
                <input type="text" value={editBookingData.name || ''} onChange={e => setEditBookingData({ ...editBookingData, name: e.target.value })} className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 text-sm outline-none focus:border-[#561668] transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#561668] uppercase tracking-widest mb-1.5">Data</label>
                  <input type="date" value={editBookingData.date || ''} onChange={e => setEditBookingData({ ...editBookingData, date: e.target.value })} className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 text-sm outline-none focus:border-[#561668] transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#561668] uppercase tracking-widest mb-1.5">Horário</label>
                  <input type="time" value={editBookingData.time || ''} onChange={e => setEditBookingData({ ...editBookingData, time: e.target.value })} className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 text-sm outline-none focus:border-[#561668] transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#561668] uppercase tracking-widest mb-1.5">Turno</label>
                  <select value={editBookingData.format || 'meio'} onChange={e => setEditBookingData({ ...editBookingData, format: e.target.value })} className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 text-sm outline-none focus:border-[#561668] transition-all">
                    <option value="meio">Meio Turno</option>
                    <option value="completo">Turno Completo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#561668] uppercase tracking-widest mb-1.5">Status</label>
                  <select value={editBookingData.status || 'Confirmado'} onChange={e => setEditBookingData({ ...editBookingData, status: e.target.value })} className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 text-sm outline-none focus:border-[#561668] transition-all">
                    <option value="Confirmado">Confirmado</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#561668] uppercase tracking-widest mb-1.5">Especialista Designada</label>
                <select value={editBookingData.assignedEmployeeId || ''} onChange={e => setEditBookingData({ ...editBookingData, assignedEmployeeId: e.target.value })} className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 text-sm outline-none focus:border-[#561668] transition-all">
                  <option value="">Nenhuma Especialista</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#561668] uppercase tracking-widest mb-1.5">Preço Total (R$)</label>
                <input type="number" value={editBookingData.totalPrice || 0} onChange={e => setEditBookingData({ ...editBookingData, totalPrice: Number(e.target.value) })} className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 text-sm outline-none focus:border-[#561668] transition-all" />
              </div>
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#efe5ee]">
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowEditBookingModal(false)} className="flex-1 py-3 text-[#80737f] font-bold text-[11px] uppercase tracking-widest hover:bg-[#f8f9fa] rounded-xl">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 text-white font-bold text-[11px] uppercase tracking-widest rounded-xl hover:opacity-90" style={{ background: '#561668' }}>Salvar (Forçar Alterações)</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('🚨 ATENÇÃO: Deletar DEFINITIVAMENTE este agendamento?')) {
                      handleDeleteBooking(editingBooking.ref);
                      setShowEditBookingModal(false);
                      setEditingBooking(null);
                    }
                  }}
                  className="w-full py-2.5 mt-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors border border-red-200"
                >
                  Excluir Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
