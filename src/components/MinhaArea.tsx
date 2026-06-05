import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ApplicationScreen, TriageData } from '../types';

export default function MinhaArea({ onScreenChange }: { onScreenChange: (screen: ApplicationScreen) => void }) {
  const { user, signOut } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [triageData, setTriageData] = useState<TriageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchBookings = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'bookings'),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (data.length === 0) {
          // Si no tiene reservas pero sí tiene triageData, puede ver Minha Area
          // Fetch triage first to check
        }
        
        setBookings(data);
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
    }

    Promise.all([fetchBookings(), fetchTriage()]).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null; // Redirecionamento é feito no App.tsx

  const nextBooking = bookings.length > 0 ? bookings[0] : null;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 mt-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-sans text-3xl md:text-4xl font-extrabold text-[#561668] tracking-tight">
            Minha Área
          </h1>
          <p className="text-[#4e434e] mt-2">Bem-vindo(a) de volta, {user.displayName || 'Cliente'}</p>
        </div>
        <button
          onClick={async () => {
            await signOut();
            onScreenChange('welcome');
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#f4ebf4] text-[#561668] rounded-xl font-bold text-sm hover:bg-[#efe5ee] transition-colors shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Sair
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-[#fff7fd] p-6 rounded-2xl shadow-[6px_6px_15px_#e0d7e0,-6px_-6px_15px_#ffffff] border border-white/40 col-span-1 h-fit">
          <div className="flex flex-col items-center text-center">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-20 h-20 rounded-full border-4 border-[#faf1fa] shadow-md mb-4" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#561668] text-white flex items-center justify-center text-3xl font-bold mb-4 shadow-md">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <h2 className="font-sans text-xl font-bold text-[#561668]">{user.displayName}</h2>
            <p className="text-xs text-[#80737f]">{user.email}</p>
            
            <div className="mt-6 w-full pt-6 border-t border-[#d1c2d0]/30 text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#80737f]">Status do Pacote</span>
              <p className="text-[#561668] font-bold text-sm mt-1">
                {nextBooking?.frequency === 'monthly' ? 'Pacote Mensal Ativo' : 'Sem pacote mensal (Avulso)'}
              </p>
              {nextBooking?.frequency === 'monthly' && (
                 <p className="text-[#80737f] text-xs font-semibold mt-1">4 Sessões Restantes no ciclo</p>
              )}
            </div>

            {/* Triage Data / Dados da Residência */}
            {triageData && (
              <div className="mt-6 w-full pt-6 border-t border-[#d1c2d0]/30 text-left">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#80737f]">Dados da Residência</span>
                  <button 
                    onClick={() => onScreenChange('triage')}
                    className="text-[10px] text-[#561668] font-bold uppercase tracking-widest hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[12px]">edit</span> Editar
                  </button>
                </div>
                <div className="bg-[#faf1fa] p-3 rounded-xl border border-[#efe5ee] text-xs text-[#4e434e] flex flex-col gap-1 font-semibold">
                  <p>{triageData.rooms} Quartos • {triageData.baths} Banheiros • {triageData.floors} Pav.</p>
                  {(triageData.marble || triageData.wood || triageData.doubleGlass || triageData.chandeliers) && (
                    <p className="text-[#703081] mt-1 text-[11px]">Superfícies nobres inclusas</p>
                  )}
                  <p className="text-[10px] text-[#80737f] mt-2 italic font-normal">
                    As alterações serão aplicadas às suas próximas contratações.
                  </p>
                </div>
              </div>
            )}

            <button 
              onClick={() => onScreenChange('pricing')}
              className="mt-6 w-full py-3 bg-[#561668] text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-md hover:bg-[#703081] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Acessar Matriz de Investimento <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          
          {/* Next Booking Highlight */}
          <div className="bg-[#561668] p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mt-10 -mr-10"></div>
            <h3 className="font-sans text-sm font-bold tracking-widest uppercase opacity-80 mb-4">Próximo Serviço</h3>
            
            {loading ? (
              <p className="animate-pulse">Carregando...</p>
            ) : nextBooking ? (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex gap-4 items-center">
                    {nextBooking.assignedEmployeeName ? (
                      <div className="w-16 h-16 rounded-full bg-[#faf1fa] border-2 border-white/30 flex items-center justify-center shadow-lg overflow-hidden">
                        <span className="material-symbols-outlined text-[32px] text-[#561668]">person</span>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-[#faf1fa] border-2 border-white/30 flex items-center justify-center shadow-lg">
                        <span className="material-symbols-outlined text-[32px] text-[#561668]">calendar_clock</span>
                      </div>
                    )}
                    <div>
                      <p className="text-2xl font-extrabold">{new Date(nextBooking.date + "T12:00:00").toLocaleDateString('pt-BR')} às {nextBooking.time || '09:00'}</p>
                      <p className="text-sm opacity-90 mt-1 font-semibold">
                        {nextBooking.assignedEmployeeName ? `Especialista: ${nextBooking.assignedEmployeeName}` : 'Especialista sendo alocada...'}
                      </p>
                      <p className="text-[11px] opacity-70 mt-0.5 uppercase tracking-wider">
                        {nextBooking.format === 'meio' ? 'Meio Turno (4h)' : 'Turno Completo (9h)'} 
                        {nextBooking.frequency === 'monthly' ? ' • Pacote Mensal' : ' • Sessão Avulsa'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/20">
                    <span className="text-xs uppercase tracking-wider opacity-80 block">Valor</span>
                    <span className="font-bold text-lg">R$ {nextBooking.totalPrice}</span>
                  </div>
                </div>
            ) : (
              <div className="text-center py-4">
                <p className="opacity-90 mb-4">Você ainda não tem nenhum agendamento.</p>
                <button 
                  onClick={() => onScreenChange('triage')}
                  className="bg-white text-[#561668] px-6 py-2 rounded-full font-bold text-sm hover:bg-[#faf1fa] transition-colors cursor-pointer shadow-sm"
                >
                  Agendar Avaliação
                </button>
              </div>
            )}
          </div>

          {/* History */}
          <div className="bg-[#fff7fd] p-6 rounded-2xl shadow-[6px_6px_15px_#e0d7e0,-6px_-6px_15px_#ffffff] border border-white/40">
            <h3 className="font-sans text-lg font-extrabold text-[#561668] mb-4">Histórico de Solicitações</h3>
            
            {loading ? (
              <p className="text-sm text-[#80737f]">Carregando histórico...</p>
            ) : bookings.length > 0 ? (
              <div className="flex flex-col gap-3">
                {bookings.map((booking) => (
                  <div key={booking.id} className="flex justify-between items-center p-4 bg-[#faf1fa] rounded-xl border border-[#efe5ee]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#f4ebf4] flex items-center justify-center text-[#561668]">
                        <span className="material-symbols-outlined text-[20px]">
                          {booking.frequency === 'monthly' ? 'all_inclusive' : 'event_available'}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[#561668]">Solicitado em: {(booking.createdAt?.toDate ? booking.createdAt.toDate() : new Date(booking.createdAt || Date.now())).toLocaleDateString('pt-BR')}</p>
                        <p className="text-xs text-[#4e434e] mt-0.5">Data do Serviço: <span className="font-semibold text-[#1e1a20]">{new Date(booking.date + "T12:00:00").toLocaleDateString('pt-BR')}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-[#561668]">R$ {booking.totalPrice}</p>
                      <p className="text-[10px] uppercase font-bold text-[#80737f] tracking-wider">{booking.status || 'Confirmado'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#80737f]">Nenhum histórico encontrado.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
