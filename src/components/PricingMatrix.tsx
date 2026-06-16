/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TriageData, AddonService, ApplicationScreen } from '../types';
import { PAME_ADDONS } from '../data';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../lib/firebase';
import { createPameCalendarEvent, generateClientCalendarUrl } from '../lib/calendar';
import { collection, addDoc, serverTimestamp, getDocs, doc, getDoc, updateDoc, setDoc, query, runTransaction } from 'firebase/firestore';
import PaymentPending from './PaymentPending';
import { createPreference } from '../services/mercadopago';
import { notifyClientAssignment, notifyAdminNewBooking, notifyEmployeeAssignment } from '../lib/NotificationService';
import { trackEvent } from '../lib/tracking';

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
  
  const handleFrequencyChange = async (newFrequency: 'monthly' | 'individual') => {
    const updatedTriage = { ...triageData, frequency: newFrequency };
    onTriageDataChange(updatedTriage);
    
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'profile', 'triage'), updatedTriage, { merge: true });
      } catch (err) {
        console.error("Failed to update triage frequency in Firestore", err);
      }
    }
  };

  const [hasReferrerDiscount] = useState<boolean>(() => {
    return !!(typeof window !== 'undefined' && localStorage.getItem('pame_referrer_uid'));
  });
  
  const [activeAddons, setActiveAddons] = useState<string[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingName, setBookingName] = useState('');
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingDateState, setBookingDateState] = useState('');
  const [bookingAddress, setBookingAddress] = useState('');
  const [modalStep, setModalStep] = useState<'form' | 'availability' | 'payment' | 'pending'>('form');

  useEffect(() => {
    if (showBookingModal) {
      if (user && !bookingName) {
        setBookingName(user.displayName || '');
      }
      if (!bookingAddress) {
        setBookingAddress(triageData.address || '');
      }
    }
  }, [showBookingModal, user, triageData.address]);
  
  // Real-time Availability States
  const [shiftTime, setShiftTime] = useState<'manha'|'tarde'|''>('manha');
  const [availabilityStatus, setAvailabilityStatus] = useState<'checking' | 'available' | 'unavailable' | 'idle'>('idle');
  const [alternativeDates, setAlternativeDates] = useState<string[]>([]);
  const [monthlyDates, setMonthlyDates] = useState<string[]>([]);
  const [unavailableMonthlyDate, setUnavailableMonthlyDate] = useState<string | null>(null);
  const [assignedEmployeeName, setAssignedEmployeeName] = useState<string>('');

  // Calendar Availability States
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date().getMonth());
  const [currentCalendarYear, setCurrentCalendarYear] = useState(new Date().getFullYear());
  const [availabilityCache, setAvailabilityCache] = useState<Record<string, boolean>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const fetchMonthAvailability = async (year: number, month: number, sId: string) => {
    if (!sId || sId === 'meio_') return;
    try {
      setLoadingAvailability(true);
      
      const response = await fetch('/api/get-availability');
      if (!response.ok) {
        throw new Error(`Error fetching availability: ${response.statusText}`);
      }
      const { employees: employeesList, blocks: blocksMap } = await response.json();
      
      const startDate = new Date(year, month, 1);
      const cache: Record<string, boolean> = {};
      
      // Calculate availability for the next 60 days to cover monthly packages
      for (let i = 0; i < 60; i++) {
        const currentDate = new Date(startDate.getTime());
        currentDate.setDate(startDate.getDate() + i);
        
        const yearStr = currentDate.getFullYear();
        const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
        
        const dayOfWeek = currentDate.getDay();
        
        // Filter employees by schedule
        const availableEmps = employeesList.filter((emp: any) => {
          if (!emp.weeklyAvailability || !emp.weeklyAvailability[dayOfWeek]) return false;
          const sched = emp.weeklyAvailability[dayOfWeek];
          if (sId === 'completo') {
            return sched.includes('completo');
          } else if (sId === 'meio_manha') {
            return sched.includes('meio_manha') || sched.includes('completo');
          } else if (sId === 'meio_tarde') {
            return sched.includes('meio_tarde') || sched.includes('completo');
          }
          return false;
        });
        
        // Check blocks
        let hasAvailableSpecialist = false;
        for (const emp of availableEmps) {
          const blockedShifts = blocksMap[emp.id]?.[dateStr] || [];
          let isBlocked = false;
          if (sId === 'completo') {
            isBlocked = blockedShifts.includes('completo') || blockedShifts.includes('meio_manha') || blockedShifts.includes('meio_tarde');
          } else if (sId === 'meio_manha') {
            isBlocked = blockedShifts.includes('meio_manha') || blockedShifts.includes('completo');
          } else if (sId === 'meio_tarde') {
            isBlocked = blockedShifts.includes('meio_tarde') || blockedShifts.includes('completo');
          }
          if (!isBlocked) {
            hasAvailableSpecialist = true;
            break;
          }
        }
        
        cache[dateStr] = hasAvailableSpecialist;
      }
      
      setAvailabilityCache(cache);
    } catch (err) {
      console.error("Erro ao carregar disponibilidade do mês:", err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const isDateAvailable = (dateStr: string) => {
    if (loadingAvailability) return false;
    
    // Past dates are not available
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr < todayStr) return false;
    
    if (selectedPlanMode === 'mensal') {
      let d = new Date(dateStr + "T12:00:00");
      for (let i = 0; i < 4; i++) {
        const yearStr = d.getFullYear();
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        const currentCheckStr = `${yearStr}-${monthStr}-${dayStr}`;
        
        if (!availabilityCache[currentCheckStr]) return false;
        d.setDate(d.getDate() + 7);
      }
      return true;
    } else {
      return !!availabilityCache[dateStr];
    }
  };

  const handlePrevMonth = () => {
    if (currentCalendarMonth === 0) {
      setCurrentCalendarMonth(11);
      setCurrentCalendarYear(prev => prev - 1);
    } else {
      setCurrentCalendarMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentCalendarMonth === 11) {
      setCurrentCalendarMonth(0);
      setCurrentCalendarYear(prev => prev + 1);
    } else {
      setCurrentCalendarMonth(prev => prev + 1);
    }
  };

  const generateCalendarDays = () => {
    const firstDayIndex = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
    const numDays = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let day = 1; day <= numDays; day++) {
      const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: day,
        isAvailable: isDateAvailable(dateStr)
      });
    }
    return days;
  };

  // Trigger availability pre-fetching
  const currentShiftId = selectedFormat === 'completo' ? 'completo' : `meio_${shiftTime}`;
  useEffect(() => {
    fetchMonthAvailability(currentCalendarYear, currentCalendarMonth, currentShiftId);
  }, [currentCalendarYear, currentCalendarMonth, currentShiftId, selectedFormat]);

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

  const getDynamicPricing = (format: 'meio' | 'completo', mode: 'avulso' | 'mensal') => {
    const isMensal = mode === 'mensal';
    const sessions = isMensal ? 4 : 1;
    const baseSession = format === 'meio' ? 350 : 450;
    
    // Dimensiones de residencia: Casa base 3Q 2B 1A
    const extraRooms = Math.max(0, triageData.rooms - 3);
    const extraBaths = Math.max(0, triageData.baths - 2);
    const extraFloors = Math.max(0, triageData.floors - 1);
    const sizeFeePerSession = (extraRooms * 50) + (extraBaths * 30) + (extraFloors * 80);
    
    const luxuryCareFeePerSession = surfaceCount * 30;
    const addonsPricePerSession = activeAddons.length * 50;

    const perSession = baseSession + sizeFeePerSession + luxuryCareFeePerSession + addonsPricePerSession;
    let total = perSession * sessions;
    
    let discount = 0;
    if (isMensal) {
       discount = format === 'meio' ? 200 : 300;
       total -= discount;
       if (hasReferrerDiscount) {
         total -= 100;
       }
    }
    
    return { total, discount };
  };

  const currentPrices = {
    meioAvulso: getDynamicPricing('meio', 'avulso').total,
    meioMensal: getDynamicPricing('meio', 'mensal').total,
    meioSavings: getDynamicPricing('meio', 'mensal').discount,
    completoAvulso: getDynamicPricing('completo', 'avulso').total,
    completoMensal: getDynamicPricing('completo', 'mensal').total,
    completoSavings: getDynamicPricing('completo', 'mensal').discount,
  };

  const basePrice = getDynamicPricing(selectedFormat, selectedPlanMode).total;
  const isTestPayment = bookingName.toLowerCase().includes('test_pame');
  const totalPrice = isTestPayment ? 1.00 : basePrice;
  const savings = isTestPayment ? 0 : (selectedFormat === 'meio' ? currentPrices.meioSavings : currentPrices.completoSavings);

  const getShiftId = () => selectedFormat === 'completo' ? 'completo' : `meio_${shiftTime}`;

  const checkAvailabilityForDate = async (dateStr: string, shiftId: string) => {
    try {
      const dateObj = new Date(dateStr + "T12:00:00");
      const dayOfWeek = dateObj.getDay();
      
      const response = await fetch('/api/get-availability');
      if (!response.ok) {
        throw new Error(`Error fetching availability: ${response.statusText}`);
      }
      const { employees, blocks } = await response.json();
      
      let availableEmps = employees.filter((emp: any) => {
        if (!emp.weeklyAvailability || !emp.weeklyAvailability[dayOfWeek]) return false;
        const sched = emp.weeklyAvailability[dayOfWeek];
        if (shiftId === 'completo') {
          return sched.includes('completo');
        } else if (shiftId === 'meio_manha') {
          return sched.includes('meio_manha') || sched.includes('completo');
        } else if (shiftId === 'meio_tarde') {
          return sched.includes('meio_tarde') || sched.includes('completo');
        }
        return false;
      });
      
      const trulyAvailable = [];
      for(let emp of availableEmps) {
        const blockedShifts = blocks[emp.id]?.[dateStr] || [];
        let isBlocked = false;
        if (shiftId === 'completo') {
          isBlocked = blockedShifts.includes('completo') || blockedShifts.includes('meio_manha') || blockedShifts.includes('meio_tarde');
        } else if (shiftId === 'meio_manha') {
          isBlocked = blockedShifts.includes('meio_manha') || blockedShifts.includes('completo');
        } else if (shiftId === 'meio_tarde') {
          isBlocked = blockedShifts.includes('meio_tarde') || blockedShifts.includes('completo');
        }
        if (!isBlocked) trulyAvailable.push(emp);
      }
      return trulyAvailable;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const handleBookingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bookingDateState) {
      alert("Por favor, selecione uma data disponível no calendário.");
      return;
    }
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
        
        await runTransaction(db, async (transaction) => {
          // 1. Reads
          const blockRefsAndSnaps = [];
          for (let dateStr of datesToBlock) {
            const blockRef = doc(db, 'employee_schedules', assignedEmployee.id, 'blocks', dateStr);
            const blockSnap = await transaction.get(blockRef);
            blockRefsAndSnaps.push({ ref: blockRef, snap: blockSnap });
          }
          const empRef = doc(db, 'employees', assignedEmployee.id);
          const empSnap = await transaction.get(empRef);

          // 2. Verify availability
          for (let item of blockRefsAndSnaps) {
            if (item.snap.exists()) {
              const shifts = item.snap.data().shifts || [];
              if (shifts.includes(shiftId)) {
                throw new Error("Slot ocupado");
              }
            }
          }

          // 3. Writes
          for (let item of blockRefsAndSnaps) {
            if (item.snap.exists()) {
              transaction.update(item.ref, { shifts: [...(item.snap.data().shifts || []), shiftId] });
            } else {
              transaction.set(item.ref, { shifts: [shiftId] });
            }
          }

          const currentAssigned = empSnap.exists() ? (empSnap.data().assignedServices || 0) : 0;
          transaction.update(empRef, {
            assignedServices: currentAssigned + (selectedPlanMode === 'mensal' ? 4 : 1)
          });
        });
        
        const addonsList = PAME_ADDONS.filter(a => activeAddons.includes(a.id)).map(a => a.name);
        const shiftStr = selectedFormat === 'meio' ? 'Meio Turno (4h)' : 'Turno Completo (9h)';
        
        if (user && user.email) {
          await notifyClientAssignment(
            bookingName,
            user.email,
            bookingPhone,
            bookingDateState,
            shiftStr,
            totalPrice,
            assignedEmployee.name,
            undefined,
            assignedEmployee.id
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
          undefined,
          undefined,
          bookingDateState,
          shiftStr,
          "Endereço liberado 24h antes do atendimento",
          addonsList,
          assignedEmployee.id
        );
        
      } catch(e) {
        console.error("Error blocking slot", e);
      }
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
        const bookingRef = await addDoc(collection(db, 'users', user.uid, 'bookings'), {
          name: bookingName,
          phone: bookingPhone,
          address: bookingAddress,
          date: bookingDateState,
          format: selectedFormat,
          frequency: triageData.frequency,
          addons: activeAddons,
          totalPrice: totalPrice,
          status: 'Confirmado',
          assignedEmployeeId: assignedEmployee?.id || null,
          assignedEmployeeName: assignedEmployee?.name || null,
          referrerUid: localStorage.getItem('pame_referrer_uid') || null,
          createdAt: serverTimestamp()
        });

        // Save the updated address to Firestore triage profile
        const updatedTriage = { ...triageData, address: bookingAddress };
        onTriageDataChange(updatedTriage);
        try {
          await setDoc(doc(db, 'users', user.uid, 'profile', 'triage'), updatedTriage, { merge: true });
        } catch (err) {
          console.error("Failed to update triage address in Firestore", err);
        }

        // Track conversion Purchase event
        trackEvent('Purchase', {
          value: totalPrice,
          planName: `${selectedPlanMode === 'mensal' ? 'Plano Mensal' : 'Serviço Avulso'} - ${selectedFormat === 'meio' ? 'Meio Turno' : 'Turno Completo'}`,
          bookingId: bookingRef.id
        });

        // ── Índice global para Concierge IA ──────────────────────────────────
        // Permite que la IA busque reservas por nombre sin conocer el UID del cliente.
        try {
          await setDoc(doc(db, 'reservas_index', bookingRef.id), {
            uid:              user.uid,
            bookingId:        bookingRef.id,
            nombre:           bookingName,
            nombre_lower:     bookingName.toLowerCase().trim(),
            email:            user.email || '',
            fecha:            bookingDateState,
            hora:             '09:00',
            formato:          selectedFormat,
            frecuencia:       triageData.frequency === 'monthly' ? 'mensal' : 'avulso',
            estado:           'Confirmado',
            empleada_nombre:  assignedEmployee?.name || '',
            empleada_email:   assignedEmployee?.email || '',
            empleada_id:      assignedEmployee?.id || '',
            precio:           totalPrice,
            notas_especiales: '',
            createdAt:        serverTimestamp(),
            updatedAt:        serverTimestamp()
          });
        } catch (indexErr) {
          console.error('Error al escribir reservas_index (no bloquea el flujo):', indexErr);
        }
        // ────────────────────────────────────────────────────────────────────

        const referrerUid = localStorage.getItem('pame_referrer_uid');
        if (referrerUid && selectedPlanMode === 'mensal') {
          try {
            const referrerDoc = await getDoc(doc(db, 'users', referrerUid));
            const referrerName = referrerDoc.exists() && referrerDoc.data().name ? referrerDoc.data().name : 'Amigo (Desconhecido)';
            
            await addDoc(collection(db, 'referrals'), {
              referrerId: referrerUid,
              referrerName: referrerName,
              referredId: user.uid,
              referredName: bookingName,
              referredEmail: user.email || '',
              bookingId: bookingRef.id,
              status: 'pending',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            localStorage.removeItem('pame_referrer_uid');
          } catch (err) {
            console.error("Erro ao registrar indicação", err);
          }
        }
      } catch (error) {
        console.error("Erro ao salvar histórico do usuário logado:", error);
      }
    }

    try {
      const pref = await createPreference({
        format: selectedFormat,
        mode: selectedPlanMode,
        triageData: triageData,
        activeAddons: activeAddons,
        clientName: bookingName,
        clientEmail: user?.email || undefined
      });

      if (pref && pref.init_point) {
        window.location.href = pref.init_point;
      } else {
        throw new Error("No init_point received from backend");
      }
    } catch (err) {
      console.error(err);
      alert("Error al iniciar el pago. Tu reserva fue guardada, pero no pudimos redirigirte a Mercado Pago.");
      setIsSaving(false);
      setModalStep('success'); // Fallback in case redirect fails
    }
  };

  const handleGoogleLoginAndSave = async () => {
    try {
      setIsSaving(true);
      await signInWithGoogle();
      const currentUser = auth.currentUser;
      if (currentUser) {
        const bookingRef = await addDoc(collection(db, 'users', currentUser.uid, 'bookings'), {
          name: bookingName,
          phone: bookingPhone,
          address: bookingAddress,
          date: bookingDateState,
          format: selectedFormat,
          frequency: triageData.frequency,
          addons: activeAddons,
          totalPrice: totalPrice,
          status: 'Confirmado',
          referrerUid: localStorage.getItem('pame_referrer_uid') || null,
          createdAt: serverTimestamp()
        });

        // Save the updated address to Firestore triage profile
        const updatedTriage = { ...triageData, address: bookingAddress };
        onTriageDataChange(updatedTriage);
        try {
          await setDoc(doc(db, 'users', currentUser.uid, 'profile', 'triage'), updatedTriage, { merge: true });
        } catch (err) {
          console.error("Failed to update triage address in Firestore", err);
        }

        // Track conversion Purchase event
        trackEvent('Purchase', {
          value: totalPrice,
          planName: `${selectedPlanMode === 'mensal' ? 'Plano Mensal' : 'Serviço Avulso'} - ${selectedFormat === 'meio' ? 'Meio Turno' : 'Turno Completo'}`,
          bookingId: bookingRef.id
        });

        // ── Índice global para Concierge IA ──────────────────────────────────
        try {
          await setDoc(doc(db, 'reservas_index', bookingRef.id), {
            uid:              currentUser.uid,
            bookingId:        bookingRef.id,
            nombre:           bookingName,
            nombre_lower:     bookingName.toLowerCase().trim(),
            email:            currentUser.email || '',
            fecha:            bookingDateState,
            hora:             '09:00',
            formato:          selectedFormat,
            frecuencia:       triageData.frequency === 'monthly' ? 'mensal' : 'avulso',
            estado:           'Confirmado',
            empleada_nombre:  '',
            empleada_email:   '',
            empleada_id:      '',
            precio:           totalPrice,
            notas_especiales: '',
            createdAt:        serverTimestamp(),
            updatedAt:        serverTimestamp()
          });
        } catch (indexErr) {
          console.error('Error al escribir reservas_index (no bloquea el flujo):', indexErr);
        }
        // ────────────────────────────────────────────────────────────────────
        
        const referrerUid = localStorage.getItem('pame_referrer_uid');
        if (referrerUid && selectedPlanMode === 'mensal') {
          try {
            const referrerDoc = await getDoc(doc(db, 'users', referrerUid));
            const referrerName = referrerDoc.exists() && referrerDoc.data().name ? referrerDoc.data().name : 'Amigo (Desconhecido)';
            
            await addDoc(collection(db, 'referrals'), {
              referrerId: referrerUid,
              referrerName: referrerName,
              referredId: currentUser.uid,
              referredName: bookingName,
              referredEmail: currentUser.email || '',
              bookingId: bookingRef.id,
              status: 'pending',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            localStorage.removeItem('pame_referrer_uid');
          } catch (err) {
            console.error("Erro ao registrar indicação", err);
          }
        }
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
      <div className="max-w-7xl mx-auto px-4 md:px-12 pt-10 pb-28 md:py-10 flex flex-col gap-10">
        
        {/* Custom Header with Luxury Copy */}
        <section className="flex flex-col gap-3 max-w-2xl">
          <span className="font-sans text-xs font-extrabold text-[#703081] uppercase tracking-[0.2em]">
            Curadoria &amp; Investimento Estritos
          </span>
          <h1 className="font-display italic text-4xl md:text-6xl font-semibold text-[#561668] tracking-tight">
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

        {/* Plan Mode Selector: Sessão Avulsa vs Pacote Mensal */}
        <div className="flex justify-center -mt-2 -mb-2">
          <div className="bg-[#f4ebf4]/60 p-1.5 rounded-2xl flex gap-1 shadow-[inset_2px_2px_4px_rgba(112,48,129,0.06),inset_-2px_-2px_4px_#ffffff] border border-[#efe5ee]/40 relative z-20 max-w-xs sm:max-w-sm w-full">
            <button
              onClick={() => handleFrequencyChange('individual')}
              className={`flex-1 py-3 px-3 sm:px-4 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest transition-all duration-300 cursor-pointer ${
                selectedPlanMode === 'avulso'
                  ? 'bg-[#561668] text-white shadow-md'
                  : 'text-[#80737f] hover:text-[#561668] hover:bg-[#faf1fa]'
              }`}
            >
              Sessão Avulsa
            </button>
            <button
              onClick={() => handleFrequencyChange('monthly')}
              className={`flex-1 py-3 px-3 sm:px-4 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest transition-all duration-300 cursor-pointer ${
                selectedPlanMode === 'mensal'
                  ? 'bg-[#561668] text-white shadow-md'
                  : 'text-[#80737f] hover:text-[#561668] hover:bg-[#faf1fa]'
              }`}
            >
              Pacote Mensal
            </button>
          </div>
        </div>

        {/* Pricing Matrix Layout */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Column 1: Meio Turno (4h) */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-[#703081] text-2xl font-bold">schedule</span>
              <h2 className="font-display italic text-2xl md:text-3xl font-semibold text-[#561668]">
                Meio Turno <span className="font-sans text-xs md:text-sm text-[#4e434e] font-normal not-italic ml-1">(4h)</span>
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
                    <span className="font-sans text-2xl font-extrabold text-[#561668]">R$ {currentPrices.meioAvulso.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                
                {/* Upsell Suggestion */}
                <div 
                  onClick={() => onTriageDataChange({ ...triageData, frequency: 'monthly' })}
                  className="bg-[#faf1fa]/60 hover:bg-[#efe5ee] border border-[#561668]/20 rounded-xl p-3 flex justify-between items-center cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#561668] text-base">info</span>
                    <span className="font-sans text-xs text-[#561668] font-bold">Considere o Pacote Mensal e economize R$ {currentPrices.meioSavings.toLocaleString('pt-BR')}</span>
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
                    <span className="font-sans text-2xl font-extrabold text-[#561668]">R$ {currentPrices.meioMensal.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-sans text-xs text-[#5d5e60] font-bold tracking-wider uppercase">
                    Economia Real
                  </span>
                  <span className="bg-[#561668] text-white text-xs font-bold px-3 py-1 rounded-full">
                    R$ {currentPrices.meioSavings.toLocaleString('pt-BR')}/mês
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Turno Completo (9h) - Highlighted */}
          <div className="flex flex-col gap-4 relative">
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-[#703081] text-2xl font-bold">update</span>
              <h2 className="font-display italic text-2xl md:text-3xl font-semibold text-[#561668]">
                Turno Completo <span className="font-sans text-xs md:text-sm text-[#4e434e] font-normal not-italic ml-1">(9h)</span>
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
                    <span className="font-sans text-2xl font-extrabold text-[#561668]">R$ {currentPrices.completoAvulso.toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                {/* Upsell Suggestion */}
                <div 
                  onClick={() => onTriageDataChange({ ...triageData, frequency: 'monthly' })}
                  className="bg-[#faf1fa]/60 hover:bg-[#efe5ee] border border-[#561668]/20 rounded-xl p-3 flex justify-between items-center cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#561668] text-base">info</span>
                    <span className="font-sans text-xs text-[#561668] font-bold">Considere o Pacote Mensal e economize R$ {currentPrices.completoSavings.toLocaleString('pt-BR')}</span>
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
                      <span className="font-sans text-3xl font-black text-[#561668] leading-none">R$ {currentPrices.completoMensal.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-[#703081]/10 p-4 rounded-xl shadow-[inset_2px_2px_4px_#d9cbd9,inset_-2px_-2px_4px_#ffffff]">
                    <span className="font-sans text-xs md:text-sm font-extrabold text-[#703081] tracking-wide">
                      Economia Real Extraordinária
                    </span>
                    <span className="bg-[#703081] text-white text-xs font-black px-3 py-1 rounded-full whitespace-nowrap shadow-sm">
                      R$ {currentPrices.completoSavings.toLocaleString('pt-BR')}/mês
                    </span>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFormat('completo');
                      setShowBookingModal(true);
                      trackEvent('InitiateCheckout', {
                        value: currentPrices.completoMensal,
                        planName: 'Plano Mensal - Turno Completo'
                      });
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
            <h2 className="font-display italic text-3xl font-semibold text-[#561668]">
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
          className="hidden md:flex bg-[#faf1fa] rounded-2xl p-6 md:p-8 shadow-[inset_4px_4px_10px_#d9cbd9,inset_-4px_-4px_10px_#ffffff] border border-white/60 flex-col md:flex-row justify-between items-center gap-6 mt-2"
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
                {savings > 0 ? `R$ ${totalPrice + savings + (hasReferrerDiscount && selectedPlanMode === 'mensal' ? 100 : 0)}` : ''}
              </span>
            </p>
            <span className="font-sans text-3xl md:text-4xl font-extrabold text-[#561668]">
              R$ {totalPrice} {selectedPlanMode === 'mensal' ? '/mês' : ''}
            </span>
            {hasReferrerDiscount && selectedPlanMode === 'mensal' && (
              <p className="text-[12px] text-green-600 font-sans font-bold mt-0.5 flex items-center justify-center md:justify-end gap-1">
                <span className="material-symbols-outlined text-[14px]">stars</span>
                Desconto VIP de Indicação: - R$ 100
              </p>
            )}
            {savings > 0 && (
              <p className="text-[12px] text-[#703081] font-sans font-bold flex items-center justify-center md:justify-end gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[14px]">local_activity</span>
                Economizando R$ {savings} na contratação recorrente!
              </p>
            )}
            <button
              onClick={() => {
                setShowBookingModal(true);
                trackEvent('InitiateCheckout', {
                  value: totalPrice,
                  planName: `${selectedPlanMode === 'mensal' ? 'Plano Mensal' : 'Serviço Avulso'} - ${selectedFormat === 'meio' ? 'Meio Turno' : 'Turno Completo'}`
                });
              }}
              className="mt-3 px-8 py-3 bg-[#561668] hover:bg-[#703081] text-white font-sans text-xs font-bold tracking-widest uppercase rounded-xl transition-all duration-300 shadow-md active:scale-95 cursor-pointer"
            >
              Reservar Cuidados Estritos
            </button>
          </div>
        </motion.section>

        {/* Mobile Fixed Bottom Sheet */}
        <div className="md:hidden fixed bottom-0 left-0 w-full z-40 bg-[#fff7fd]/95 backdrop-blur-md border-t border-[#efe5ee]/60 px-5 py-3.5 bottom-nav-safe shadow-[0_-6px_20px_rgba(112,48,129,0.08)] flex justify-between items-center gap-3">
          <div className="flex flex-col gap-0.5 text-left">
            <span className="font-sans text-[9px] font-extrabold text-[#703081] uppercase tracking-[0.1em]">Investimento Estimado</span>
            <span className="font-sans text-xl font-extrabold text-[#561668]">R$ {totalPrice} {selectedPlanMode === 'mensal' ? '/mês' : ''}</span>
            {savings > 0 && (
              <span className="text-[9px] text-green-700 font-bold">Economia ativa</span>
            )}
          </div>
          <button
            onClick={() => {
              setShowBookingModal(true);
              trackEvent('InitiateCheckout', {
                value: totalPrice,
                planName: `${selectedPlanMode === 'mensal' ? 'Plano Mensal' : 'Serviço Avulso'} - ${selectedFormat === 'meio' ? 'Meio Turno' : 'Turno Completo'}`
              });
            }}
            className="px-6 py-3 bg-[#561668] hover:bg-[#703081] text-white font-sans text-xs font-bold tracking-widest uppercase rounded-xl transition-all duration-300 shadow-md active-scale cursor-pointer flex items-center justify-center gap-1.5"
            style={{ minHeight: '44px' }}
          >
            Reservar
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        {/* Brand Integrity Footer */}
        <footer className="w-full mt-10 border-t border-[#d1c2d0]/30 pt-12 pb-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <img
            alt="METODO PAME"
            className="h-10 w-auto opacity-80 cursor-pointer"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJul2j80hhyNHenR0y3YscP1-t9rYnu_EqX3FaOMN3WGZIujzQSchb9q9SRkyDZsh7T-P1GG0HfJY1y19iFn_ln-YDdAqpet7kpfxVcv6IVKrVoOBTsBr2DSQIqSoUDlGhiPr3omFSRbnLEWNEOZ1o2UmITxVTHvq3zcW8U1eneJdIp0SgtVowyJnIUQ5Km8txrCteRNy7jChVdxmB35COFzqOOztOq7ey-7AoD0e1xrobOF07muHkD1VkP2WGRyqPgmHc6O_dC4Tw"
          />
          <div className="flex flex-wrap justify-center gap-6 font-sans text-[11px] font-bold uppercase tracking-widest">
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-privacy-modal'))} className="text-[#80737f] hover:text-[#561668] transition-colors cursor-pointer font-bold">Privacy Policy</button>
            <a className="text-[#80737f] hover:text-[#561668] transition-colors" href="#">Google Credibility</a>
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-terms-modal'))} className="text-[#80737f] hover:text-[#561668] transition-colors cursor-pointer font-bold">Terms of Service</button>
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
              className="bg-[#fff7fd] max-w-lg w-full rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl relative border border-[#efe5ee]/40 font-sans"
            >
              <button
                onClick={() => { setShowBookingModal(false); setModalStep('form'); }}
                className="absolute top-3 right-3 w-11 h-11 rounded-full bg-[#f4ebf4] text-[#4e434e] flex items-center justify-center hover:bg-[#efe5ee] transition-colors cursor-pointer z-10 active-scale"
                style={{ minWidth: '44px', minHeight: '44px' }}
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

                  {hasReferrerDiscount && selectedPlanMode === 'mensal' && (
                    <div className="bg-[#561668]/10 border border-[#561668]/20 rounded-xl p-3 text-center text-xs font-bold text-[#561668] flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base animate-pulse">stars</span>
                      <span>Você está utilizando o convite VIP do Círculo de Excelência Método Pame. R$ 100 de desconto aplicados ao seu primeiro mês!</span>
                    </div>
                  )}

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
                    <label className="text-[11px] font-extrabold text-[#561668] uppercase tracking-widest" htmlFor="bookingAddress">
                      Endereço Completo de Atendimento
                    </label>
                    <input
                      id="bookingAddress"
                      type="text"
                      required
                      placeholder="Ex: Rua das Flores, 123 - Centro, Tijucas/SC"
                      value={bookingAddress}
                      onChange={(e) => setBookingAddress(e.target.value)}
                      className="w-full h-11 px-4 bg-[#f4ebf4] border border-[#d1c2d0] focus:border-[#561668] focus:ring-1 focus:ring-[#561668] rounded-lg text-sm text-[#1e1a20]"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-extrabold text-[#561668] uppercase tracking-widest">
                      Data Desejada {selectedPlanMode === 'mensal' && <span className="text-xs text-[#80737f] lowercase font-normal">(Início do pacote)</span>}
                    </label>
                    
                    <div className="bg-[#fcf7fc] border border-[#efe5ee] rounded-xl p-4 flex flex-col gap-3">
                      {/* Month Switcher Header */}
                      <div className="flex justify-between items-center px-1">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="w-8 h-8 rounded-full bg-[#f4ebf4] text-[#561668] flex items-center justify-center hover:bg-[#efe5ee] transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                        </button>
                        <span className="text-xs font-extrabold text-[#561668] uppercase tracking-wider">
                          {MONTH_NAMES[currentCalendarMonth]} {currentCalendarYear}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="w-8 h-8 rounded-full bg-[#f4ebf4] text-[#561668] flex items-center justify-center hover:bg-[#efe5ee] transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                        </button>
                      </div>

                      {/* Weekdays Header */}
                      <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-extrabold text-[#80737f] uppercase tracking-widest">
                        <span>Dom</span>
                        <span>Seg</span>
                        <span>Ter</span>
                        <span>Qua</span>
                        <span>Qui</span>
                        <span>Sex</span>
                        <span>Sáb</span>
                      </div>

                      {/* Days Grid */}
                      {loadingAvailability ? (
                        <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-xs text-[#80737f]">
                          <div className="w-6 h-6 border-2 border-[#efe5ee] border-t-[#561668] rounded-full animate-spin"></div>
                          <span>Carregando disponibilidade...</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-7 gap-1">
                          {generateCalendarDays().map((day, idx) => {
                            if (!day) {
                              return <div key={`empty-${idx}`} className="h-9" />;
                            }

                            const isSelected = bookingDateState === day.dateStr;
                            
                            return (
                              <button
                                key={day.dateStr}
                                type="button"
                                disabled={!day.isAvailable}
                                onClick={() => setBookingDateState(day.dateStr)}
                                className={`h-9 text-xs rounded-lg flex flex-col items-center justify-center transition-all ${
                                  isSelected
                                    ? 'bg-[#561668] text-white font-extrabold shadow-md'
                                    : day.isAvailable
                                    ? 'bg-[#fcf0fc] text-[#561668] font-bold border border-[#f4ebf4] hover:bg-[#561668] hover:text-white cursor-pointer'
                                    : 'bg-[#f5f0f5]/40 text-[#c2b2c2] cursor-not-allowed line-through'
                                }`}
                              >
                                <span>{day.dayNum}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Hidden validation input so the form HTML5 validator still works */}
                      <input
                        type="hidden"
                        required
                        value={bookingDateState}
                        onChange={() => {}}
                      />
                      
                      {/* Selected Date Indicator */}
                      <div className="text-center mt-1 border-t border-[#efe5ee] pt-2">
                        {bookingDateState ? (
                          <p className="text-xs font-bold text-[#561668]">
                            Data selecionada: <span className="bg-[#561668]/10 px-2 py-0.5 rounded-full">{bookingDateState.split('-').reverse().join('/')}</span>
                            {selectedPlanMode === 'mensal' && (
                              <span className="block text-[10px] text-[#80737f] mt-1 font-normal leading-relaxed">
                                (Seu pacote cobrirá as próximas 4 semanas consecutivas neste mesmo dia da semana)
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-[#80737f] italic">Nenhuma data selecionada. Escolha uma das datas disponíveis acima.</p>
                        )}
                      </div>
                    </div>
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
