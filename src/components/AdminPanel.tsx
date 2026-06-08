import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, collectionGroup } from 'firebase/firestore';
import { notifyEmployeeRemoval, notifyEmployeeAssignment } from '../lib/NotificationService';

export interface Employee {
  id: string;
  name: string;
  photoURL: string;
  role: string;
  cpf?: string;
  whatsapp?: string;
  email?: string;
  zones?: string;
  active?: boolean;
  assignedServices: number;
  weeklyAvailability: {
    [dayIndex: number]: ('meio_manha' | 'meio_tarde' | 'completo')[];
  };
}

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const SHIFTS = [
  { id: 'meio_manha', label: 'Meio Turno Manhã' },
  { id: 'meio_tarde', label: 'Meio Turno Tarde' },
  { id: 'completo', label: 'Turno Completo' },
];

export default function AdminPanel({ onScreenChange }: { onScreenChange: (screen: string) => void }) {
  const { user, signInWithGoogle } = useAuth();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'employees' | 'bookings'>('employees');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('Especialista em Limpeza');
  
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Employee>>({});

  const [showEditBookingModal, setShowEditBookingModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [editBookingData, setEditBookingData] = useState<any>({});

  useEffect(() => {
    if (user) {
      fetchEmployees();
    }
  }, [user]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'employees'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(data);
      
      // Intentamos obtener los bookings globales
      try {
        const bq = query(collectionGroup(db, 'bookings'));
        const bSnap = await getDocs(bq);
        setBookings(bSnap.docs.map(d => ({ docId: d.id, ref: d.ref, ...d.data() })));
      } catch (e) {
        console.warn("No se pudo cargar collectionGroup bookings. Requiere index.", e);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName) return;
    
    const newEmp = {
      name: newEmpName,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(newEmpName)}&background=561668&color=fff`,
      role: newEmpRole,
      assignedServices: 0,
      weeklyAvailability: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [] }, // Empty initially
      createdAt: serverTimestamp()
    };
    
    try {
      await addDoc(collection(db, 'employees'), newEmp);
      setShowAddModal(false);
      setNewEmpName('');
      fetchEmployees();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAvailability = async (empId: string, dayIdx: number, shiftId: string, currentAvail: any) => {
    const dayAvail = currentAvail[dayIdx] || [];
    let newDayAvail = [...dayAvail];
    
    if (newDayAvail.includes(shiftId)) {
      newDayAvail = newDayAvail.filter((s: string) => s !== shiftId);
    } else {
      newDayAvail.push(shiftId);
    }
    
    const newWeeklyAvail = { ...currentAvail, [dayIdx]: newDayAvail };
    
    // Optimistic update
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, weeklyAvailability: newWeeklyAvail } : e));
    
    try {
      await updateDoc(doc(db, 'employees', empId), {
        weeklyAvailability: newWeeklyAvail
      });
    } catch (err) {
      console.error(err);
      fetchEmployees(); // revert on fail
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      await updateDoc(doc(db, 'employees', editingEmployee.id), editFormData);
      setShowEditModal(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEmployee = async (empId: string) => {
    if (confirm("Tem certeza que deseja desativar (ocultar) esta especialista? Ela não será apagada da base de dados.")) {
      try {
        await updateDoc(doc(db, 'employees', empId), { active: false });
        fetchEmployees();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleHardDeleteEmployee = async (empId: string) => {
    if (confirm("🚨 ATENÇÃO: Tem certeza que deseja DELETAR DEFINITIVAMENTE esta especialista? Essa ação não pode ser desfeita.")) {
      try {
        await deleteDoc(doc(db, 'employees', empId));
        fetchEmployees();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteBooking = async (bookingRef: any) => {
    if (confirm("🚨 ATENÇÃO: Tem certeza que deseja DELETAR DEFINITIVAMENTE este agendamento? Essa ação não pode ser desfeita.")) {
      try {
        await deleteDoc(bookingRef);
        fetchEmployees();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteAllBookings = async () => {
    if (confirm("🚨 PERIGO EXTREMO: Você está prestes a DELETAR TODAS AS RESERVAS do sistema. Digite 'CONFIRMAR' para continuar.")) {
      const userInput = prompt("Digite CONFIRMAR para apagar todas as reservas:");
      if (userInput === "CONFIRMAR") {
        setLoading(true);
        try {
          for (const b of bookings) {
            await deleteDoc(b.ref);
          }
          alert("Todas as reservas foram apagadas com sucesso.");
          fetchEmployees();
        } catch (err) {
          console.error(err);
          alert("Erro ao apagar reservas. Verifique o console.");
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleDeleteAllEmployees = async () => {
    if (confirm("🚨 PERIGO EXTREMO: Você está prestes a DELETAR TODAS AS ESPECIALISTAS do sistema. Digite 'CONFIRMAR' para continuar.")) {
      const userInput = prompt("Digite CONFIRMAR para apagar todas as especialistas:");
      if (userInput === "CONFIRMAR") {
        setLoading(true);
        try {
          for (const emp of employees) {
            await deleteDoc(doc(db, 'employees', emp.id));
          }
          alert("Todas as especialistas foram apagadas com sucesso.");
          fetchEmployees();
        } catch (err) {
          console.error(err);
          alert("Erro ao apagar especialistas. Verifique o console.");
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleEditBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;

    try {
      let finalData = { ...editBookingData };
      if (editBookingData.assignedEmployeeId) {
        const selectedEmp = employees.find(emp => emp.id === editBookingData.assignedEmployeeId);
        if (selectedEmp) {
           finalData.assignedEmployeeName = selectedEmp.name;
        }
      }

      await updateDoc(editingBooking.ref, finalData);
      setShowEditBookingModal(false);
      setEditingBooking(null);
      fetchEmployees();
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8f9fa]">
        <div className="bg-white p-8 rounded-2xl shadow-[4px_4px_15px_rgba(0,0,0,0.05)] max-w-sm w-full text-center border border-[#efe5ee]">
          <h1 className="text-2xl font-extrabold text-[#561668] mb-2 tracking-tight">Painel Administrativo</h1>
          <p className="text-sm text-[#4e434e] mb-8">Acesso restrito à gerência do Método Pame.</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full py-4 bg-[#561668] hover:bg-[#703081] transition-colors text-white rounded-xl font-bold uppercase tracking-widest text-xs"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-[#d1c2d0]/30 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#561668] tracking-tight">Dashboard Gerencial</h1>
          <p className="text-[#80737f] mt-1 text-sm font-medium">Gestão de Funcionárias, Agendas e Designações</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 md:p-3 rounded-2xl shadow-sm border border-[#efe5ee]">
          <img src={user.photoURL || ''} alt="Admin" className="w-10 h-10 rounded-full border-2 border-[#faf1fa]" />
          <div className="text-right pr-2 hidden md:block">
            <p className="text-sm font-bold text-[#1e1a20]">{user.displayName}</p>
            <p className="text-xs text-[#80737f] uppercase tracking-wider font-bold">Administradora</p>
          </div>
        </div>
      </header>
      
      <div className="flex gap-4 mb-8 border-b border-[#efe5ee]">
        <button 
          onClick={() => setActiveTab('employees')}
          className={`pb-3 px-4 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'employees' ? 'text-[#561668] border-b-2 border-[#561668]' : 'text-[#80737f] hover:text-[#1e1a20]'}`}
        >
          Equipe
        </button>
        <button 
          onClick={() => setActiveTab('bookings')}
          className={`pb-3 px-4 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'bookings' ? 'text-[#561668] border-b-2 border-[#561668]' : 'text-[#80737f] hover:text-[#1e1a20]'}`}
        >
          Agendamentos
        </button>
      </div>

      <section>
        {activeTab === 'employees' && (
          <div className="w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-[#561668]">Especialistas (Funcionárias)</h2>
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-[#561668] hover:bg-[#703081] transition-colors text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm"
              >
                + Nova Especialista
              </button>
            </div>
            
            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-[#efe5ee] p-12 text-center text-[#80737f]">
                Carregando base de dados...
              </div>
            ) : employees.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-[#efe5ee] p-12 text-center flex flex-col items-center">
                <span className="material-symbols-outlined text-4xl text-[#d1c2d0] mb-3">group_off</span>
                <p className="text-[#80737f] font-medium">Nenhuma especialista cadastrada ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {employees.filter(e => e.active !== false).map(emp => (
                  <div key={emp.id} className="bg-white rounded-2xl shadow-sm border border-[#efe5ee] p-5 flex flex-col gap-4 relative">
                    
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingEmployee(emp);
                          setEditFormData({
                            name: emp.name,
                            role: emp.role,
                            cpf: emp.cpf || '',
                            whatsapp: emp.whatsapp || '',
                            zones: emp.zones || ''
                          });
                          setShowEditModal(true);
                        }}
                        className="w-8 h-8 rounded-full bg-[#f4ebf4] text-[#561668] flex items-center justify-center hover:bg-[#efe5ee] transition-colors"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteEmployee(emp.id)}
                        className="w-8 h-8 rounded-full bg-[#f4ebf4] text-[#d9534f] flex items-center justify-center hover:bg-[#ffebee] transition-colors"
                        title="Ocultar/Desativar"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                      </button>
                      <button 
                        onClick={() => handleHardDeleteEmployee(emp.id)}
                        className="w-8 h-8 rounded-full bg-[#ffebee] text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors"
                        title="Deletar Permanentemente"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                      </button>
                    </div>

                    <div className="flex items-start justify-between border-b border-[#efe5ee]/50 pb-4 pr-20">
                      <div className="flex gap-4 items-center">
                        <img src={emp.photoURL} alt={emp.name} className="w-14 h-14 rounded-full border-2 border-[#faf1fa]" />
                        <div>
                          <h3 className="font-extrabold text-lg text-[#1e1a20]">{emp.name}</h3>
                          <p className="text-xs text-[#80737f] font-bold uppercase tracking-wider">{emp.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-[#80737f] uppercase tracking-widest font-bold">Carga (Mês)</p>
                        <p className="font-black text-2xl text-[#561668]">{emp.assignedServices}</p>
                      </div>
                    </div>

                    <div className="mt-1">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-[#561668]">Disponibilidade Semanal</h4>
                        <span className="text-[10px] text-[#80737f] italic">// TODO: Integrar vista de auto-gestión en el portal /equipe</span>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {DAYS_OF_WEEK.map((dayName, idx) => {
                          const isActive = emp.weeklyAvailability && emp.weeklyAvailability[idx] && emp.weeklyAvailability[idx].length > 0;
                          return (
                            <div key={dayName} className="flex flex-col md:flex-row md:items-center gap-2 bg-[#f8f9fa] p-2.5 rounded-xl border border-[#efe5ee]">
                              <span className={`w-24 text-xs font-bold uppercase tracking-widest ${isActive ? 'text-[#561668]' : 'text-[#a397a2]'}`}>
                                {dayName}
                              </span>
                              <div className="flex flex-wrap gap-2 flex-1">
                                {SHIFTS.map(shift => {
                                  const isSelected = emp.weeklyAvailability && emp.weeklyAvailability[idx]?.includes(shift.id as any);
                                  return (
                                    <button
                                      key={shift.id}
                                      onClick={() => toggleAvailability(emp.id, idx, shift.id, emp.weeklyAvailability || {})}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
                                        isSelected 
                                          ? 'bg-[#561668] text-white' 
                                          : 'bg-white text-[#80737f] border border-[#d1c2d0] hover:border-[#561668]/50'
                                      }`}
                                    >
                                      {shift.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="mt-2 pt-4 border-t border-[#efe5ee]/50">
                      <h4 className="text-sm font-bold text-[#561668] mb-2">Últimos Serviços Atendidos</h4>
                      <div className="flex flex-col gap-2">
                        {bookings.filter(b => b.assignedEmployeeId === emp.id).slice(0, 3).map((b, i) => (
                          <div key={i} className="text-xs flex justify-between items-center bg-[#faf1fa] p-2 rounded">
                            <span className="font-semibold text-[#1e1a20]">{b.name}</span>
                            <span className="text-[#80737f]">{b.date} • {b.format === 'meio' ? 'Meio Turno' : 'Turno Completo'}</span>
                          </div>
                        ))}
                        {bookings.filter(b => b.assignedEmployeeId === emp.id).length === 0 && (
                          <span className="text-xs text-[#80737f] italic">Nenhum serviço registrado ainda.</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#efe5ee] p-6">
            <h2 className="text-xl font-extrabold text-[#561668] mb-6">Controle de Agendamentos</h2>
            {bookings.length === 0 ? (
              <p className="text-[#80737f] text-sm">Nenhum agendamento encontrado ou requer configuração de índice no Firestore.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f8f9fa] text-[#80737f] uppercase tracking-widest text-[10px] font-bold">
                    <tr>
                      <th className="p-4 rounded-tl-xl">Cliente</th>
                      <th className="p-4">Data</th>
                      <th className="p-4">Turno</th>
                      <th className="p-4">Designada</th>
                      <th className="p-4 rounded-tr-xl">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.docId} className="border-b border-[#efe5ee] hover:bg-[#faf1fa]/50 transition-colors">
                        <td className="p-4 font-bold text-[#1e1a20]">{b.name}</td>
                        <td className="p-4 text-[#4e434e]">{b.date}</td>
                        <td className="p-4 text-[#4e434e]">{b.format}</td>
                        <td className="p-4">
                          <span className="bg-[#561668]/10 text-[#561668] px-3 py-1 rounded-full font-bold text-[11px]">
                            {b.assignedEmployeeName || 'Nenhuma'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-3">
                            <button 
                              onClick={() => {
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
                              className="text-[#561668] font-bold text-[11px] uppercase tracking-wider hover:underline"
                            >
                              Editar (Modo Deus)
                            </button>
                            <button 
                              onClick={async () => {
                                const newEmp = employees.find(e => e.id !== b.assignedEmployeeId);
                                if (newEmp) {
                                  const oldEmp = employees.find(e => e.id === b.assignedEmployeeId);
                                  await notifyEmployeeRemoval(oldEmp?.name || b.assignedEmployeeName, oldEmp?.email, b.date);
                                  await notifyEmployeeAssignment(newEmp.name, newEmp.email || 'especialista@metodopame.com.br', b.date, b.format, "Endereço do Cliente", []);
                                  alert(`Reatribuindo para ${newEmp.name}.\n\nNotificação enviada para ${b.assignedEmployeeName} (Removida).\nNotificação enviada para ${newEmp.name} (Nova).\nGoogle Calendar atualizado.`);
                                } else {
                                  alert('Não há outras funcionárias disponíveis para reatribuir.');
                                }
                              }}
                              className="text-[#703081] font-bold text-[11px] uppercase tracking-wider hover:underline"
                            >
                              Reatribuir Rápido
                            </button>
                            <button 
                              onClick={() => handleDeleteBooking(b.ref)}
                              className="text-red-600 font-bold text-[11px] uppercase tracking-wider hover:underline ml-2 border-l border-[#efe5ee] pl-3"
                            >
                              Deletar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Danger Zone */}
      <section className="mt-12">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-extrabold text-red-700 mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined">warning</span>
            Danger Zone
          </h2>
          <p className="text-red-900/80 text-sm mb-6">Ações nesta área são irreversíveis e afetam o banco de dados de produção diretamente. Tenha cuidado.</p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleDeleteAllBookings}
              className="bg-red-600 hover:bg-red-700 transition-colors text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              Apagar TODAS as Reservas
            </button>
            
            <button 
              onClick={handleDeleteAllEmployees}
              className="bg-red-600 hover:bg-red-700 transition-colors text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">group_remove</span>
              Apagar TODAS as Especialistas
            </button>
          </div>
        </div>
      </section>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#1e1a20]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-[#efe5ee]">
            <h2 className="text-xl font-extrabold text-[#561668] mb-5">Adicionar Especialista</h2>
            <form onSubmit={handleAddEmployee} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-extrabold text-[#561668] uppercase tracking-widest">Nome Completo</label>
                <input 
                  type="text" 
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full h-11 px-4 bg-[#f8f9fa] border border-[#d1c2d0] focus:border-[#561668] focus:ring-1 rounded-xl text-sm"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-extrabold text-[#561668] uppercase tracking-widest">Cargo/Função</label>
                <input 
                  type="text" 
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  className="w-full h-11 px-4 bg-[#f8f9fa] border border-[#d1c2d0] focus:border-[#561668] focus:ring-1 rounded-xl text-sm"
                  required
                />
              </div>
              <div className="flex gap-3 mt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-[#80737f] hover:text-[#1e1a20]"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-[#561668] hover:bg-[#703081] transition-colors text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-md"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingEmployee && (
        <div className="fixed inset-0 bg-[#1e1a20]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-[#561668] p-6 text-white text-center">
              <h3 className="font-extrabold text-xl">Editar Especialista</h3>
            </div>
            <form onSubmit={handleEditEmployee} className="p-6 flex flex-col gap-4">
              
              <div>
                <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  value={editFormData.name || ''}
                  onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                  className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Cargo</label>
                <input 
                  type="text" 
                  required
                  value={editFormData.role || ''}
                  onChange={e => setEditFormData({...editFormData, role: e.target.value})}
                  className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">CPF</label>
                <input 
                  type="text" 
                  value={editFormData.cpf || ''}
                  onChange={e => setEditFormData({...editFormData, cpf: e.target.value})}
                  className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">WhatsApp</label>
                <input 
                  type="text" 
                  value={editFormData.whatsapp || ''}
                  onChange={e => setEditFormData({...editFormData, whatsapp: e.target.value})}
                  className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Email (Para Notificações)</label>
                <input 
                  type="email" 
                  value={editFormData.email || ''}
                  onChange={e => setEditFormData({...editFormData, email: e.target.value})}
                  className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Zonas de Atendimento</label>
                <input 
                  type="text" 
                  value={editFormData.zones || ''}
                  onChange={e => setEditFormData({...editFormData, zones: e.target.value})}
                  className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                />
              </div>

              <div className="flex gap-3 mt-4 pt-4 border-t border-[#efe5ee]">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 text-[#80737f] font-bold text-xs uppercase tracking-widest hover:bg-[#f8f9fa] rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-[#561668] text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-[#703081] transition-colors shadow-md"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditBookingModal && editingBooking && (
        <div className="fixed inset-0 bg-[#1e1a20]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-[#561668] p-6 text-white text-center">
              <h3 className="font-extrabold text-xl">Editar Agendamento (Modo Deus)</h3>
            </div>
            <form onSubmit={handleEditBooking} className="p-6 flex flex-col gap-4">
              
              <div>
                <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Cliente</label>
                <input 
                  type="text" 
                  value={editBookingData.name || ''}
                  onChange={e => setEditBookingData({...editBookingData, name: e.target.value})}
                  className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Data</label>
                  <input 
                    type="date" 
                    value={editBookingData.date || ''}
                    onChange={e => setEditBookingData({...editBookingData, date: e.target.value})}
                    className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Horário</label>
                  <input 
                    type="time" 
                    value={editBookingData.time || ''}
                    onChange={e => setEditBookingData({...editBookingData, time: e.target.value})}
                    className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Turno</label>
                  <select 
                    value={editBookingData.format || 'meio'}
                    onChange={e => setEditBookingData({...editBookingData, format: e.target.value})}
                    className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  >
                    <option value="meio">Meio Turno</option>
                    <option value="completo">Turno Completo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Status</label>
                  <select 
                    value={editBookingData.status || 'Confirmado'}
                    onChange={e => setEditBookingData({...editBookingData, status: e.target.value})}
                    className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  >
                    <option value="Confirmado">Confirmado</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Especialista Designada</label>
                <select 
                  value={editBookingData.assignedEmployeeId || ''}
                  onChange={e => setEditBookingData({...editBookingData, assignedEmployeeId: e.target.value})}
                  className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                >
                  <option value="">Nenhuma Especialista</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#561668] uppercase tracking-widest mb-1.5">Preço Total (R$)</label>
                <input 
                  type="number" 
                  value={editBookingData.totalPrice || 0}
                  onChange={e => setEditBookingData({...editBookingData, totalPrice: Number(e.target.value)})}
                  className="w-full bg-[#f8f9fa] border border-[#efe5ee] rounded-xl p-3 focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                />
              </div>

              <div className="flex gap-3 mt-4 pt-4 border-t border-[#efe5ee]">
                <button 
                  type="button"
                  onClick={() => setShowEditBookingModal(false)}
                  className="flex-1 py-3 text-[#80737f] font-bold text-xs uppercase tracking-widest hover:bg-[#f8f9fa] rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-[#561668] text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-[#703081] transition-colors shadow-md"
                >
                  Salvar (Forçar Alterações)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
