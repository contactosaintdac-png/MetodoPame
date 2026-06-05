/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TriageData, AddonService, ApplicationScreen } from '../types';
import { PAME_ADDONS } from '../data';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../lib/firebase';
import { createPameCalendarEvent, generateClientCalendarUrl } from '../lib/calendar';
import { collection, addDoc, serverTimestamp, getDocs, doc, getDoc, updateDoc, setDoc, query } from 'firebase/firestore';
import PaymentPending from './PaymentPending';
import { createPreference } from '../services/mercadopago';
import { notifyClientAssignment, notifyAdminNewBooking, notifyEmployeeAssignment } from '../lib/NotificationService';

interface PricingMatrixProps {
  triageData: TriageData;
  onTriageDataChange: (data: TriageData) => void;
  onScreenChange: (screen: ApplicationScreen) => void;
}

export default function PricingMatrix({ triageData, onTriageDataChange, onScreenChange }: PricingMatrixProps) {
  const { signInWithGoogle, user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'meio' | 'completo'>(
    triageData.frequency === 'monthly' ? 'completo' : 'meio'
  );
  // Use fallback so if somehow it is empty it defaults safely
  const selectedPlanMode = triageData.frequency === 'monthly' ? 'mensal' : 'avulso';
  
  const [activeAddons, setActiveAddons] = useState<string[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingName, setBookingName] = useState('');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingDateState, setBookingDateState] = useState('');
  const [modalStep, setModalStep] = useState<'form' | 'availability' | 'payment' | 'pending'>('form');
  
  // Real-time Availability States
  const [shiftTime, setShiftTime] = useState<'manha'|'tarde'|''>('');
  const [availabilityStatus, setAvailabilityStatus] = useState<'checking' | 'available' | 'unavailable' | 'idle'>('idle');
  const [alternativeDates, setAlternativeDates] = useState<string[]>([]);
  const [monthlyDates, setMonthlyDates] = useState<string[]>([]);
  const [unavailableMonthlyDate, setUnavailableMonthlyDate] = useState<string | null>(null);
  const [assignedEmployeeName, setAssignedEmployeeName] = useState<string>('');

  // Surface treatment overhead estimation (luxury Order care)
  const surfaceCount = [
    triageData.marble,
    triageData.wood,
    triageData.doubleGlass,
    triageData.chandeliers,
  ].filter(Boolean).length;

  const toggleAddon = (id: string) => {
    setActiveAddons((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const getPricingLogic = (format: 'meio' | 'completo', mode: 'avulso' | 'mensal') => {
    if (format === 'meio') {
      if (mode === 'avulso') {
        return { total: 350, employee: 200, pameProfit: 150, sessions: 1 };
      } else {
        return { total: 1200, employee: 800, pameProfit: 400, sessions: 4 }; // 300 per session, employee gets 200
      }
    } else {
      if (mode === 'avulso') {
        return { total: 450, employee: 300, pameProfit: 150, sessions: 1 };
      } else {
        return { total: 1500, employee: 1200, pameProfit: 300, sessions: 4 }; // 375 per session, employee gets 300
      }
    }
  };

  const pricingLogic = getPricingLogic(selectedFormat, selectedPlanMode);
  
  const getSavings = (format: 'meio' | 'completo', mode: 'avulso' | 'mensal') => {
    if (mode === 'avulso') return 0;
    // For Meio Turno: Individual is 350. Package is 1200 (4 * 350 = 1400 -> saves 200)
    // For Turno Completo: Individual is 450. Package is 1500 (4 * 450 = 1800 -> saves 300)
    return format === 'meio' ? 200 : 300;
  };

  const basePrice = pricingLogic.total;
  const savings = getSavings(selectedFormat, selectedPlanMode);
  // Optional admin debug view for internal calculation
  const employeePay = pricingLogic.employee;
  const pameNetProfit = pricingLogic.pameProfit;

  const addonsPrice = activeAddons.length * 50;
  const luxuryCareFee = surfaceCount * 30; // Adding R$30 for custom fine-finishes luxury care
  // TODO: Implementar precio dinámico por dimensiones de residencia (triageData.rooms, triageData.baths, triageData.floors)
  const totalPrice = basePrice + addonsPrice + luxuryCareFee;

  const getShiftId = () => selectedFormat === 'completo' ? 'completo' : `meio_${shiftTime}`;

  const checkAvailabilityForDate = async (dateStr: string, shiftId: string) => {
    try {
      const dateObj = new Date(dateStr + "T12:00:00");
      const dayOfWeek = dateObj.getDay();
      
      const q = query(collection(db, 'employees'));
      const empSnap = await getDocs(q);
      const employees = empSnap.docs.map(d => ({id: d.id, ...d.data()})) as any[];
      
      let availableEmps = employees.filter(emp => 
        emp.weeklyAvailability && 
        emp.weeklyAvailability[dayOfWeek] && 
        emp.weeklyAvailability[dayOfWeek].includes(shiftId)
      );
      
      const trulyAvailable = [];
      for(let emp of availableEmps) {
        const blockDoc = await getDoc(doc(db, 'employee_schedules', emp.id, 'blocks', dateStr));
        if (blockDoc.exists()) {
          const blockedShifts = blockDoc.data().shifts || [];
          if (!blockedShifts.includes(shiftId)) trulyAvailable.push(emp);
        } else {
          trulyAvailable.push(emp);
        }
      }
      return trulyAvailable;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const handleBookingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedFormat === 'meio' && !shiftTime) {
      alert("Por favor, selecione se prefere Manhã ou Tarde.");
      return;
    }
    
    setModalStep('availability');
    setAvailabilityStatus('checking');
    
    const shiftId = getShiftId();
    
    if (selectedPlanMode === 'mensal') {
      let dates = [];
      let d = new Date(bookingDateState + "T12:00:00");
      for(let i=0; i<4; i++) {
        dates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 7);
      }
      setMonthlyDates(dates);
      
      let failedDate = null;
      for (let dateStr of dates) {
        const avails = await checkAvailabilityForDate(dateStr, shiftId);
        if (avails.length === 0) {
          failedDate = dateStr;
          break;
        }
      }
      
      if (failedDate) {
        setUnavailableMonthlyDate(failedDate);
        setAvailabilityStatus('unavailable');
      } else {
        setAvailabilityStatus('available');
      }
    } else {
      const avails = await checkAvailabilityForDate(bookingDateState, shiftId);
      if (avails.length > 0) {
        setAvailabilityStatus('available');
      } else {
        setAvailabilityStatus('unavailable');
        // Find next 5 alternatives
        let alts = [];
        let checkD = new Date(bookingDateState + "T12:00:00");
        while(alts.length < 5) {
          checkD.setDate(checkD.getDate() + 1);
          const iso = checkD.toISOString().split('T')[0];
          const avails2 = await checkAvailabilityForDate(iso, shiftId);
          if (avails2.length > 0) alts.push(iso);
          if (checkD > new Date(Date.now() + 60*24*60*60*1000)) break; // stop after 60 days max
        }
        setAlternativeDates(alts);
      }
    }
  };

  const handlePaymentSelect = async (method: 'pix' | 'card') => {
    setModalStep('pending');
    
    // LOAD BALANCING ASSIGNMENT
    const shiftId = getShiftId();
    let assignedEmployee = null;
    
    if (selectedPlanMode === 'mensal') {
      const availablePerDate = await Promise.all(monthlyDates.map(d => checkAvailabilityForDate(d, shiftId)));
      let intersection = availablePerDate[0] || [];
      for(let i=1; i<monthlyDates.length; i++) {
         intersection = intersection.filter(emp => (availablePerDate[i] || []).find(e => e.id === emp.id));
      }
      if (intersection.length > 0) {
        intersection.sort((a, b) => (a.assignedServices || 0) - (b.assignedServices || 0));
        assignedEmployee = intersection[0];
      }
    } else {
      const avails = await checkAvailabilityForDate(bookingDateState, shiftId);
      if (avails.length > 0) {
        avails.sort((a, b) => (a.assignedServices || 0) - (b.assignedServices || 0));
        assignedEmployee = avails[0];
      }
    }

    if (assignedEmployee) {
      setAssignedEmployeeName(assignedEmployee.name);
      try {
        const datesToBlock = selectedPlanMode === 'mensal' ? monthlyDates : [bookingDateState];
        for (let dateStr of datesToBlock) {
          const blockRef = doc(db, 'employee_schedules', assignedEmployee.id, 'blocks', dateStr);
          const blockSnap = await getDoc(blockRef);
          if (blockSnap.exists()) {
            await updateDoc(blockRef, { shifts: [...(blockSnap.data().shifts || []), shiftId] });
          } else {
            await setDoc(blockRef, { shifts: [shiftId] });
          }
        }
        await updateDoc(doc(db, 'employees', assignedEmployee.id), {
          assignedServices: (assignedEmployee.assignedServices || 0) + (selectedPlanMode === 'mensal' ? 4 : 1)
        });
        
        const addonsList = PAME_ADDONS.filter(a => activeAddons.includes(a.id)).map(a => a.name);
        const shiftStr = selectedFormat === 'meio' ? 'Meio Turno (4h)' : 'Turno Completo (9h)';
        
        if (user && user.email) {
          await notifyClientAssignment(
            bookingName,
            user.email,
            bookingDateState,
            shiftStr,
            totalPrice,
            assignedEmployee.name,
            assignedEmployee.photo
          );
        }
        
        await notifyAdminNewBooking(
          bookingName,
          bookingDateState,
          shiftStr,
          totalPrice,
          assignedEmployee.name,
          addonsList
        );

        await notifyEmployeeAssignment(
          assignedEmployee.name,
          assignedEmployee.email, // using email instead of whatsapp
          bookingDateState,
          shiftStr,
          "Endereço no App", // We could fetch from triage data
          addonsList
        );
        
      } catch(e) {
        console.error("Error blocking slot", e);
      }
    }
    
    try {
      await createPreference({
        title: `Faxina MÉTODO PAME — ${selectedFormat === 'meio' ? 'Meio Turno' : 'Turno Completo'}`,
        totalValue: totalPrice,
        clientName: bookingName,
      });
    } catch (err) {
      console.error(err);
    }
    
    try {
      await createPameCalendarEvent({
        clientName: bookingName + (assignedEmployee ? ` (${assignedEmployee.name})` : ''),
        date: new Date(bookingDateState + "T12:00:00"),
        shift: selectedFormat === 'meio' ? 'Meio Turno (4h)' : 'Turno Completo (9h)',
        modality: selectedPlanMode === 'mensal' ? 'Plano Mensal' : 'Serviço Avulso',
        addons: PAME_ADDONS.filter(a => activeAddons.includes(a.id)).map(a => a.name),
        totalValue: totalPrice
      });
    } catch (err) {
      console.error("Falha ao agendar calendário", err);
    }

    if (user) {
      try {
        await addDoc(collection(db, 'users', user.uid, 'bookings'), {
          name: bookingName,
          phone: bookingPhone,
          date: bookingDateState,
          format: selectedFormat,
          frequency: triageData.frequency,
          addons: activeAddons,
          totalPrice: totalPrice,
          status: 'Confirmado',
          assignedEmployeeId: assignedEmployee?.id || null,
          assignedEmployeeName: assignedEmployee?.name || null,
          createdAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Erro ao salvar histórico do usuário logado:", error);
      }
    }
  };

  const handleGoogleLoginAndSave = async () => {
    try {
      setIsSaving(true);
      await signInWithGoogle();
      const currentUser = auth.currentUser;
      if (currentUser) {
        await addDoc(collection(db, 'users', currentUser.uid, 'bookings'), {
          name: bookingName,
          phone: bookingPhone,
          date: bookingDateState,
          format: selectedFormat,
          frequency: triageData.frequency,
          addons: activeAddons,
          totalPrice: totalPrice,
          status: 'Confirmado',
          createdAt: serverTimestamp()
        });
        setShowBookingModal(false);
        setModalStep('form');
        onScreenChange('minha-area');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-[#fff7fd]">
      <div className="max-w-7xl mx-auto px-4 md:px-12 py-10 flex flex-col gap-10">
        
        {/* Custom Header with Luxury Copy */}
        <section className="flex flex-col gap-3 max-w-2xl">
          <span className="font-sans text-xs font-extrabold text-[#703081] uppercase tracking-[0.2em]">
            Curadoria &amp; Investimento Estritos
          </span>
          <h1 className="font-sans text-3xl md:text-5xl font-extrabold text-[#561668] tracking-tight">
            Matriz de Investimento
          </h1>
          <p className="font-sans text-[16px] md:text-lg text-[#4e434e] leading-relaxed">
            Transparência em cada detalhe. Escolha a estrutura ideal para a manutenção e valorização de alto padrão do seu ambiente.
          </p>
        </section>

        {/* Real-time Triage Summary Box if completed */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/50 backdrop-blur-md rounded-2xl p-5 border border-[#efe5ee] shadow-[4px_4px_12px_rgba(112,48,129,0.04)] flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#faf1fa] flex items-center justify-center text-[#561668]">
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified_user
              </span>
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#703081] tracking-widest uppercase">
                Estrutura Avaliada da sua Residência
              </p>
              <p className="text-sm font-semibold text-[#1e1a20] whitespace-nowrap mt-0.5">
                {triageData.rooms} Quartos • {triageData.baths} Banheiros • {triageData.floors} {triageData.floors === 1 ? 'Pavimento' : 'Pavimentos'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {triageData.marble && <span className="bg-[#561668]/15 text-[#561668] text-[11px] font-bold px-3 py-1 rounded-full">Mármore</span>}
            {triageData.wood && <span className="bg-[#561668]/15 text-[#561668] text-[11px] font-bold px-3 py-1 rounded-full">Madeira Maciça</span>}
            {triageData.doubleGlass && <span className="bg-[#561668]/15 text-[#561668] text-[11px] font-bold px-3 py-1 rounded-full">Vidros Grandes</span>}
            {triageData.chandeliers && <span className="bg-[#561668]/15 text-[#561668] text-[11px] font-bold px-3 py-1 rounded-full">Lustres finos</span>}
            {surfaceCount === 0 && <span className="text-xs text-[#80737f] italic">Nenhuma superfície nobre selecionada</span>}
          </div>
        </motion.div>

        {/* Pricing Matrix Layout */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Column 1: Meio Turno (4h) */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-[#703081] text-2xl font-bold">schedule</span>
              <h2 className="font-sans text-xl md:text-2xl font-bold text-[#561668]">
                Meio Turno <span className="font-sans text-sm md:text-base text-[#4e434e] font-normal ml-1">(4h)</span>
              </h2>
            </div>

            {/* Render Only Selected Mode Card for Meio Turno */}
            {selectedPlanMode === 'avulso' ? (
              <div className="flex flex-col gap-3">
                <div 
                  onClick={() => setSelectedFormat('meio')}
                  className={`rounded-2xl p-6 transition-all duration-300 cursor-pointer ${
                    selectedFormat === 'meio'
                      ? 'bg-[#faf1fa] border-2 border-[#561668] shadow-[inset_3px_3px_6px_#d9cbd9,inset_-3px_-3px_6px_#ffffff]'
                      : 'bg-[#fff7fd] border border-[#efe5ee] hover:bg-[#faf1fa] shadow-[6px_6px_12px_#d9cbd9,-6px_-6px_12px_#ffffff]'
                  } flex justify-between items-center group`}
                >
                  <div>
                    <h3 className="font-sans text-lg font-bold text-[#561668] group-hover:text-[#703081] transition-colors">
                      Sessão Avulsa
                    </h3>
                    <p className="font-sans text-xs text-[#4e434e] mt-1 font-semibold tracking-wide">
                      Manutenção pontual
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-sans text-2xl font-extrabold text-[#561668]">R$ 350</span>
                  </div>
                </div>
                
                {/* Upsell Suggestion */}
                <div 
                  onClick={() => onTriageDataChange({ ...triageData, frequency: 'monthly' })}
                  className="bg-[#faf1fa]/60 hover:bg-[#efe5ee] border border-[#561668]/20 rounded-xl p-3 flex justify-between items-center cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#561668] text-base">info</span>
                    <span className="font-sans text-xs text-[#561668] font-bold">Considere o Pacote Mensal e economize R$ 200</span>
                  </div>
                  <span className="material-symbols-outlined text-[#561668] text-base">arrow_forward</span>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setSelectedFormat('meio')}
                className={`rounded-2xl p-6 transition-all duration-300 cursor-pointer flex flex-col gap-3 ${
                  selectedFormat === 'meio'
                    ? 'bg-[#faf1fa] border-2 border-[#561668] shadow-[inset_3px_3px_6px_#d9cbd9,inset_-3px_-3px_6px_#ffffff]'
                    : 'bg-[#f4ebf4] border border-[#561668]/15 hover:bg-[#faf1fa] shadow-[6px_6px_12px_#d9cbd9,-6px_-6px_12px_#ffffff]'
                }`}
              >
                <div className="flex justify-between items-center border-b border-[#d1c2d0]/30 pb-3">
                  <div>
                    <h3 className="font-sans text-lg font-extrabold text-[#561668]">Pacote Mensal</h3>
                    <p className="font-sans text-xs text-[#4e434e] mt-1 font-semibold tracking-wide">4 sessões por mês</p>
                  </div>
                  <div className="text-right">
                    <span className="font-sans text-2xl font-extrabold text-[#561668]">R$ 1.200</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-sans text-xs text-[#5d5e60] font-bold tracking-wider uppercase">
                    Economia Real
                  </span>
                  <span className="bg-[#561668] text-white text-xs font-bold px-3 py-1 rounded-full">
                    R$ 200/mês
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Turno Completo (9h) - Highlighted */}
          <div className="flex flex-col gap-4 relative">
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-[#703081] text-2xl font-bold">update</span>
              <h2 className="font-sans text-xl md:text-2xl font-bold text-[#561668]">
                Turno Completo <span className="font-sans text-sm md:text-base text-[#4e434e] font-normal ml-1">(9h)</span>
              </h2>
            </div>

            {/* Render Only Selected Mode Card for Turno Completo */}
            {selectedPlanMode === 'avulso' ? (
              <div className="flex flex-col gap-3">
                <div 
                  onClick={() => setSelectedFormat('completo')}
                  className={`rounded-2xl p-6 transition-all duration-300 cursor-pointer ${
                    selectedFormat === 'completo'
                      ? 'bg-[#faf1fa] border-2 border-[#561668] shadow-[inset_3px_3px_6px_#d9cbd9,inset_-3px_-3px_6px_#ffffff]'
                      : 'bg-[#fff7fd] border border-[#efe5ee] hover:bg-[#faf1fa] shadow-[6px_6px_12px_#d9cbd9,-6px_-6px_12px_#ffffff]'
                  } flex justify-between items-center group`}
                >
                  <div>
                    <h3 className="font-sans text-lg font-bold text-[#561668] group-hover:text-[#703081] transition-colors">
                      Sessão Avulsa
                    </h3>
                    <p className="font-sans text-xs text-[#4e434e] mt-1 font-semibold tracking-wide">
                      Intervenção profunda
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-sans text-2xl font-extrabold text-[#561668]">R$ 450</span>
                  </div>
                </div>

                {/* Upsell Suggestion */}
                <div 
                  onClick={() => onTriageDataChange({ ...triageData, frequency: 'monthly' })}
                  className="bg-[#faf1fa]/60 hover:bg-[#efe5ee] border border-[#561668]/20 rounded-xl p-3 flex justify-between items-center cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#561668] text-base">info</span>
                    <span className="font-sans text-xs text-[#561668] font-bold">Considere o Pacote Mensal e economize R$ 300</span>
                  </div>
                  <span className="material-symbols-outlined text-[#561668] text-base">arrow_forward</span>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setSelectedFormat('completo')}
                className={`rounded-2xl p-8 transition-all duration-300 cursor-pointer border-2 relative overflow-hidden flex flex-col gap-4 ${
                  selectedFormat === 'completo'
                    ? 'border-[#561668] bg-[#faf1fa] ring-4 ring-[#561668]/5 shadow-[inset_3px_3px_8px_#d9cbd9,inset_-3px_-3px_8px_#ffffff]'
                    : 'border-[#703081] bg-[#fff7fd] hover:bg-[#faf1fa] shadow-[6px_6px_15px_#d9cbd9,-6px_-6px_15px_#ffffff]'
                }`}
              >
                {/* Smart Choice Tag matching Image 1 */}
                <div className="absolute top-0 right-0 bg-[#703081] text-white font-sans text-[10px] font-extrabold px-4 py-1.5 rounded-bl-xl uppercase tracking-widest z-10">
                  A Escolha Inteligente
                </div>

                <div className="mt-2 flex flex-col gap-4">
                  <div className="flex justify-between items-center pb-3 border-b border-[#d1c2d0]/30 mr-8">
                    <div>
                      <h3 className="font-sans text-xl font-extrabold text-[#561668]">Pacote Mensal</h3>
                      <p className="font-sans text-sm text-[#4e434e] mt-0.5 font-medium">4 sessões por mês</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="font-sans text-3xl font-black text-[#561668] leading-none">R$ 1.500</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-[#703081]/10 p-4 rounded-xl shadow-[inset_2px_2px_4px_#d9cbd9,inset_-2px_-2px_4px_#ffffff]">
                    <span className="font-sans text-xs md:text-sm font-extrabold text-[#703081] tracking-wide">
                      Economia Real Extraordinária
                    </span>
                    <span className="bg-[#703081] text-white text-xs font-black px-3 py-1 rounded-full whitespace-nowrap shadow-sm">
                      R$ 300/mês
                    </span>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFormat('completo');
                      setShowBookingModal(true);
                    }}
                    className="w-full mt-2 py-4 rounded-xl bg-[#703081] text-white font-sans font-extrabold text-xs tracking-widest hover:opacity-95 transition-opacity uppercase shadow-lg active:scale-98 cursor-pointer"
                  >
                    Agendar Avaliação
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Dynamic Addons Services Area */}
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="font-sans text-2xl font-extrabold text-[#561668]">
              Serviços Adicionais de Alta Gama
            </h2>
            <p className="font-sans text-sm text-[#4e434e] mt-1 leading-relaxed">
              Especialize a sua sessão com técnicas dedicadas de alto requinte para o seu lar. (Toque para incluir)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PAME_ADDONS.map((addon) => {
              const isChecked = activeAddons.includes(addon.id);
              return (
                <div
                  key={addon.id}
                  onClick={() => toggleAddon(addon.id)}
                  className={`rounded-2xl p-5 border cursor-pointer hover:shadow-lg transition-all flex items-center justify-between group select-none ${
                    isChecked
                      ? 'bg-[#faf1fa] border-[#561668]/30 shadow-[inset_2px_2px_5px_#d9cbd9,inset_-2px_-2px_5px_#ffffff]'
                      : 'bg-[#fff7fd] border-transparent shadow-[4px_4px_10px_#d9cbd9,-4px_-4px_10px_#ffffff]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors shadow-[inset_2px_2px_4px_#d9cbd9,inset_-2px_-2px_4px_#ffffff] ${
                      isChecked ? 'bg-[#561668]/15 text-[#561668]' : 'bg-[#fff7fd] text-[#703081]'
                    }`}>
                      <span className="material-symbols-outlined text-[20px] font-bold">
                        {addon.icon}
                      </span>
                    </div>
                    <div>
                      <span className="font-sans text-[15px] font-bold text-[#1e1a20]">
                        {addon.name}
                      </span>
                      <p className="text-[10px] text-[#80737f] mt-0.5 max-w-[150px] leading-tight">
                        {addon.description}
                      </p>
                    </div>
                  </div>
                  <span className="font-sans text-xs font-extrabold text-[#703081] bg-[#703081]/10 px-2.5 py-1 rounded-full">
                    + R$ 50
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Dynamic Estimated Total Summary Card */}
        <motion.section 
          layout
          className="bg-[#faf1fa] rounded-2xl p-6 md:p-8 shadow-[inset_4px_4px_10px_#d9cbd9,inset_-4px_-4px_10px_#ffffff] border border-white/60 flex flex-col md:flex-row justify-between items-center gap-6 mt-2"
        >
          <div className="flex flex-col gap-1.5 text-center md:text-left">
            <span className="font-sans text-xs font-extrabold text-[#703081] uppercase tracking-[0.2em]">
              Orçamento de Ordem Estimado
            </span>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
              <span className="text-xs bg-[#561668] text-white font-bold px-3 py-1 rounded-full">
                {selectedFormat === 'meio' ? 'Meio Turno (4h)' : 'Turno Completo (9h)'}
              </span>
              <span className="text-xs bg-[#703081] text-white font-bold px-3 py-1 rounded-full">
                {selectedPlanMode === 'avulso' ? 'Serviço Avulso' : 'Plano Mensal'}
              </span>
              {activeAddons.length > 0 && (
                <span className="text-xs bg-[#efe5ee] text-[#561668] font-bold px-3 py-1 rounded-full border border-[#d1c2d0]/30">
                  +{activeAddons.length} Adicionais
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-2 text-center md:text-right">
            <p className="text-[14px] text-[#4e434e] font-sans font-semibold">
              Total Calculado:{' '}
              <span className="text-[#80737f] text-xs font-normal line-through ml-1.5">
                {savings > 0 ? `R$ ${totalPrice + savings}` : ''}
              </span>
            </p>
            <span className="font-sans text-3xl md:text-4xl font-extrabold text-[#561668]">
              R$ {totalPrice} {selectedPlanMode === 'mensal' ? '/mês' : ''}
            </span>
            {savings > 0 && (
              <p className="text-[12px] text-[#703081] font-sans font-bold flex items-center justify-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[14px]">local_activity</span>
                Economizando R$ {savings} na contratação recorrente!
              </p>
            )}
            <button
              onClick={() => setShowBookingModal(true)}
              className="mt-3 px-8 py-3 bg-[#561668] hover:bg-[#703081] text-white font-sans text-xs font-bold tracking-widest uppercase rounded-xl transition-all duration-300 shadow-md active:scale-95 cursor-pointer"
            >
              Reservar Cuidados Estritos
            </button>
          </div>
        </motion.section>

        {/* Brand Integrity Footer */}
        <footer className="w-full mt-10 border-t border-[#d1c2d0]/30 pt-12 pb-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <img
            alt="METODO PAME"
            className="h-10 w-auto opacity-80 cursor-pointer"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJul2j80hhyNHenR0y3YscP1-t9rYnu_EqX3FaOMN3WGZIujzQSchb9q9SRkyDZsh7T-P1GG0HfJY1y19iFn_ln-YDdAqpet7kpfxVcv6IVKrVoOBTsBr2DSQIqSoUDlGhiPr3omFSRbnLEWNEOZ1o2UmITxVTHvq3zcW8U1eneJdIp0SgtVowyJnIUQ5Km8txrCteRNy7jChVdxmB35COFzqOOztOq7ey-7AoD0e1xrobOF07muHkD1VkP2WGRyqPgmHc6O_dC4Tw"
          />
          <div className="flex flex-wrap justify-center gap-6 font-sans text-[11px] font-bold uppercase tracking-widest">
            <a className="text-[#80737f] hover:text-[#561668] transition-colors" href="#">Privacy Policy</a>
            <a className="text-[#80737f] hover:text-[#561668] transition-colors" href="#">Google Credibility</a>
            <a className="text-[#80737f] hover:text-[#561668] transition-colors" href="#">Terms of Service</a>
          </div>
          <div className="font-sans text-[10px] font-bold text-[#80737f] tracking-wide text-center md:text-right leading-relaxed">
            © 2026 MÉTODO PAME.<br />Excellence in Home Care. Tijucas, SC.
          </div>
        </footer>

      </div>

      {/* Booking Form Overlay Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <div className="fixed inset-0 bg-[#38333d]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#fff7fd] max-w-lg w-full rounded-2xl p-6 md:p-8 shadow-2xl relative border border-[#efe5ee]/40 font-sans"
            >
              <button
                onClick={() => { setShowBookingModal(false); setModalStep('form'); }}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f4ebf4] text-[#4e434e] flex items-center justify-center hover:bg-[#efe5ee] transition-colors cursor-pointer z-10"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>

              {modalStep === 'form' && (
                <form onSubmit={handleBookingSubmit} className="flex flex-col gap-4 mt-2">
                  <div className="text-center mb-2">
                    <span className="material-symbols-outlined text-[#561668] text-4xl">event_available</span>
                    <h3 className="text-xl font-extrabold text-[#561668] mt-1">Agendar Avaliação</h3>
                    <p className="text-xs text-[#80737f] mt-1 uppercase tracking-widest font-bold">
                      Orçamento Reservado: R$ {totalPrice} {selectedPlanMode === 'mensal' ? '(Mensal)' : ''}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-extrabold text-[#561668] uppercase tracking-widest" htmlFor="bookingName">
                      Nome Completo
                    </label>
                    <input
                      id="bookingName"
                      type="text"
                      required
                      placeholder="Ex: Amanda Silva"
                      value={bookingName}
                      onChange={(e) => setBookingName(e.target.value)}
                      className="w-full h-11 px-4 bg-[#f4ebf4] border border-[#d1c2d0] focus:border-[#561668] focus:ring-1 focus:ring-[#561668] rounded-lg text-sm text-[#1e1a20]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-extrabold text-[#561668] uppercase tracking-widest" htmlFor="bookingPhone">
                      WhatsApp ou Celular
                    </label>
                    <input
                      id="bookingPhone"
                      type="tel"
                      required
                      placeholder="Ex: (48) 99999-9999"
                      value={bookingPhone}
                      onChange={(e) => setBookingPhone(e.target.value)}
                      className="w-full h-11 px-4 bg-[#f4ebf4] border border-[#d1c2d0] focus:border-[#561668] focus:ring-1 focus:ring-[#561668] rounded-lg text-sm text-[#1e1a20]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-extrabold text-[#561668] uppercase tracking-widest" htmlFor="bookingDate">
                      Data Desejada
                    </label>
                    <input
                      id="bookingDate"
                      type="date"
                      required
                      value={bookingDateState}
                      onChange={(e) => setBookingDateState(e.target.value)}
                      className="w-full h-11 px-4 bg-[#f4ebf4] border border-[#d1c2d0] focus:border-[#561668] focus:ring-1 focus:ring-[#561668] rounded-lg text-sm text-[#1e1a20]"
                    />
                  </div>

                  {selectedFormat === 'meio' && (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <label className="text-[11px] font-extrabold text-[#561668] uppercase tracking-widest">
                        Preferência de Turno
                      </label>
                      <div className="flex gap-3">
                        <label className={`flex-1 py-3 border rounded-xl text-center text-sm font-bold cursor-pointer transition-all ${shiftTime === 'manha' ? 'bg-[#561668] text-white border-[#561668]' : 'bg-[#f4ebf4] text-[#80737f] border-[#d1c2d0] hover:border-[#561668]/50'}`}>
                          <input type="radio" name="shiftTime" value="manha" className="hidden" checked={shiftTime === 'manha'} onChange={() => setShiftTime('manha')} />
                          Manhã (08h - 12h)
                        </label>
                        <label className={`flex-1 py-3 border rounded-xl text-center text-sm font-bold cursor-pointer transition-all ${shiftTime === 'tarde' ? 'bg-[#561668] text-white border-[#561668]' : 'bg-[#f4ebf4] text-[#80737f] border-[#d1c2d0] hover:border-[#561668]/50'}`}>
                          <input type="radio" name="shiftTime" value="tarde" className="hidden" checked={shiftTime === 'tarde'} onChange={() => setShiftTime('tarde')} />
                          Tarde (13h - 17h)
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="bg-[#561668]/15 p-3 rounded-lg flex gap-3 text-xs text-[#561668] text-left leading-relaxed mt-2">
                    <span className="material-symbols-outlined shrink-0 text-[18px]">info</span>
                    <div>
                      <p className="font-bold">Protocolo de Confirmação</p>
                      <p className="opacity-90 mt-0.5">
                        Sua triagem realizada ({triageData.rooms}Q, {triageData.baths}B) foi vinculada. Prossiga para confirmar a forma de pagamento.
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#561668] hover:bg-[#703081] text-white font-sans text-xs font-bold tracking-widest uppercase rounded-lg shadow-md transition-all duration-300"
                  >
                    Avançar para Pagamento
                  </button>
                </form>
              )}

              {modalStep === 'availability' && (
                <div className="flex flex-col items-center justify-center py-6 gap-5 w-full font-sans text-center">
                  {availabilityStatus === 'checking' && (
                    <>
                      <div className="w-12 h-12 border-4 border-[#efe5ee] border-t-[#561668] rounded-full animate-spin"></div>
                      <div>
                        <h3 className="text-xl font-extrabold text-[#561668]">Verificando Disponibilidade...</h3>
                        <p className="text-sm text-[#4e434e] mt-1">Cruzando agendas com nossas especialistas.</p>
                      </div>
                    </>
                  )}
                  
                  {availabilityStatus === 'available' && (
                    <>
                      <span className="material-symbols-outlined text-[48px] text-[#4e8d52]">check_circle</span>
                      <div>
                        <h3 className="text-2xl font-extrabold text-[#561668]">Data Confirmada!</h3>
                        <p className="text-sm text-[#4e434e] mt-2">
                          Temos especialistas de alto padrão disponíveis para {selectedPlanMode === 'mensal' ? 'as datas selecionadas' : 'esta data'}.
                        </p>
                      </div>
                      <button 
                        onClick={() => setModalStep('payment')}
                        className="w-full py-4 mt-4 bg-[#561668] hover:bg-[#703081] text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-md transition-all"
                      >
                        Avançar para Pagamento
                      </button>
                    </>
                  )}
                  
                  {availabilityStatus === 'unavailable' && (
                    <div className="w-full flex flex-col gap-4">
                      <span className="material-symbols-outlined text-[48px] text-[#a397a2]">event_busy</span>
                      <div>
                        <h3 className="text-2xl font-extrabold text-[#561668]">Agenda Indisponível</h3>
                        <p className="text-sm text-[#4e434e] mt-2">
                          Nossas especialistas já estão designadas para {selectedPlanMode === 'mensal' ? `o dia ${unavailableMonthlyDate ? unavailableMonthlyDate.split('-').reverse().join('/') : ''}` : `o dia ${bookingDateState.split('-').reverse().join('/')}`} no turno selecionado.
                        </p>
                      </div>
                      
                      <div className="bg-[#f4ebf4] p-4 rounded-xl text-left border border-[#efe5ee] mt-2">
                        <p className="text-xs font-bold text-[#561668] uppercase tracking-widest mb-3">Próximas Datas Disponíveis</p>
                        {alternativeDates.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {alternativeDates.map(dateStr => {
                              const [y, m, d] = dateStr.split('-');
                              return (
                                <button 
                                  key={dateStr}
                                  onClick={() => {
                                    setBookingDateState(dateStr);
                                    setModalStep('form');
                                  }}
                                  className="w-full text-left py-3 px-4 bg-white rounded-lg border border-[#d1c2d0] hover:border-[#561668] text-sm text-[#1e1a20] font-semibold flex justify-between items-center transition-colors shadow-sm"
                                >
                                  <span>{`${d}/${m}/${y}`}</span>
                                  <span className="text-[#561668] text-xs font-bold uppercase">Selecionar</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-[#4e434e] italic text-center py-2">
                            Não encontramos datas disponíveis com a equipe atual. Por favor, ajuste a disponibilidade no painel.
                          </p>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => setModalStep('form')}
                        className="mt-2 text-xs text-[#80737f] underline hover:text-[#561668]"
                      >
                        Voltar e escolher outra data
                      </button>
                    </div>
                  )}
                </div>
              )}

              {modalStep === 'payment' && (
                <div className="flex flex-col items-center justify-center py-4 gap-5 w-full font-sans mt-4">
                  <div className="text-center">
                    <h3 className="text-2xl font-extrabold text-[#561668]">Forma de Pagamento</h3>
                    <p className="text-sm text-[#4e434e] mt-2">Selecione como deseja concluir a reserva do seu serviço de alto padrão.</p>
                  </div>
                  
                  <div className="w-full flex flex-col gap-3 mt-2">
                    <button onClick={() => handlePaymentSelect('pix')} className="w-full py-4 bg-[#f4ebf4] hover:bg-[#efe5ee] border border-[#d1c2d0]/50 text-[#561668] rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-sm font-bold text-sm hover:shadow-md cursor-pointer">
                      <span className="material-symbols-outlined">qr_code_scanner</span>
                      Pagar com Pix
                    </button>
                    <button onClick={() => handlePaymentSelect('card')} className="w-full py-4 bg-[#f4ebf4] hover:bg-[#efe5ee] border border-[#d1c2d0]/50 text-[#561668] rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-sm font-bold text-sm hover:shadow-md cursor-pointer">
                      <span className="material-symbols-outlined">credit_card</span>
                      Pagar com Cartão
                    </button>
                  </div>
                  
                  <div className="mt-4 border-t border-[#d1c2d0]/30 w-full pt-6 flex flex-col items-center">
                    <span className="text-[10px] text-[#80737f] uppercase font-bold tracking-widest mb-1">Total a Pagar</span>
                    <span className="text-4xl font-black text-[#561668] tracking-tight">R$ {totalPrice}</span>
                    
                    {selectedPlanMode === 'mensal' && savings > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-[#4e8d52] bg-[#f0f9f1] border border-[#4e8d52]/20 px-3 py-1.5 rounded-full shadow-[inset_1px_1px_3px_#ffffff]">
                        <span className="material-symbols-outlined text-[15px]">trending_down</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Você está economizando R$ {savings} nesta contratação recorrente</span>
                      </div>
                    )}
                  </div>
                  
                  <button onClick={() => setModalStep('form')} className="mt-4 text-xs text-[#80737f] underline hover:text-[#561668] cursor-pointer">Voltar para os dados</button>
                </div>
              )}

              {modalStep === 'pending' && (
                <div className="w-full flex flex-col items-center mt-2">
                  <PaymentPending 
                    clientName={bookingName}
                    format={selectedFormat === 'meio' ? 'Meio Turno (4h)' : 'Turno Completo (9h)'}
                    planMode={selectedPlanMode === 'mensal' ? 'Plano Mensal' : 'Serviço Avulso'}
                    addons={PAME_ADDONS.filter(a => activeAddons.includes(a.id)).map(a => a.name)}
                    totalPrice={totalPrice}
                  />
                  
                  <div className="w-full max-w-sm mt-5 flex flex-col gap-3">
                    <a
                      href={generateClientCalendarUrl({
                        clientName: bookingName,
                        date: new Date(bookingDateState + "T12:00:00"),
                        shift: selectedFormat === 'meio' ? 'Meio Turno (4h)' : 'Turno Completo (9h)',
                        modality: selectedPlanMode === 'mensal' ? 'Plano Mensal' : 'Serviço Avulso',
                        addons: PAME_ADDONS.filter(a => activeAddons.includes(a.id)).map(a => a.name),
                        totalValue: totalPrice
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex justify-center items-center gap-2 py-3.5 bg-[#4285F4] text-white font-bold text-[11px] uppercase tracking-widest rounded-xl hover:bg-[#3367D6] transition-colors cursor-pointer shadow-md"
                    >
                      <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                      Adicionar à minha agenda
                    </a>
                    
                    {!user && (
                      <button
                        onClick={handleGoogleLoginAndSave}
                        disabled={isSaving}
                        className="w-full flex justify-center items-center gap-2 py-3.5 bg-[#fff7fd] border-2 border-[#561668] text-[#561668] font-bold text-[11px] uppercase tracking-widest rounded-xl hover:bg-[#faf1fa] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                        {isSaving ? 'Salvando...' : 'Salvar histórico (Entrar com Google)'}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowBookingModal(false);
                        setModalStep('form');
                        onScreenChange('welcome');
                      }}
                      className="mt-3 text-xs text-[#80737f] underline hover:text-[#561668] cursor-pointer text-center"
                    >
                      Fechar e voltar ao início
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
