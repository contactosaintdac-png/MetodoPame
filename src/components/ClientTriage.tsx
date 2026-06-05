/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TriageData, ApplicationScreen } from '../types';
import { INITIAL_TRIAGE_DATA } from '../data';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ClientTriageProps {
  triageData: TriageData;
  onTriageDataChange: (data: TriageData) => void;
  onScreenChange: (screen: ApplicationScreen) => void;
}

export default function ClientTriage({
  triageData,
  onTriageDataChange,
  onScreenChange,
}: ClientTriageProps) {
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, signInWithGoogle } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const updateField = <K extends keyof TriageData>(key: K, value: TriageData[K]) => {
    onTriageDataChange({
      ...triageData,
      [key]: value,
    });
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'profile', 'triage'), triageData);
      } catch (err) {
        console.error("Failed to save triage data", err);
      }
    }

    setTimeout(() => {
      setIsSubmitting(false);
      onScreenChange('pricing');
    }, 1200);
  };

  // Helper counters
  const increment = (field: 'rooms' | 'baths' | 'floors') => {
    updateField(field, Math.min(20, triageData[field] + 1));
  };

  const decrement = (field: 'rooms' | 'baths' | 'floors') => {
    updateField(field, Math.max(1, triageData[field] - 1));
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-12 px-4 relative overflow-hidden bg-[#fff7fd]">
      {/* Decorative Ambient Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#fcd7ff] blur-[100px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-[#e9e0e8] blur-[80px] opacity-60 pointer-events-none" />

      {/* Navigation float-back button */}
      <button 
        onClick={() => onScreenChange('welcome')}
        className="absolute top-6 left-6 flex items-center gap-2 p-3 bg-white/60 backdrop-blur-md rounded-xl hover:bg-[#efe5ee] text-[#561668] transition-all duration-300 font-sans text-xs tracking-wider uppercase font-bold cursor-pointer shadow-[2px_2px_6px_rgba(112,48,129,0.06)]"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Voltar ao início
      </button>

      <div className="w-full max-w-3xl z-10">
        {/* Header content matching Image 2 */}
        <div className="text-center mb-10">
          <img
            alt="METODO PAME"
            className="h-20 w-auto mx-auto mb-3 object-contain cursor-pointer"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJul2j80hhyNHenR0y3YscP1-t9rYnu_EqX3FaOMN3WGZIujzQSchb9q9SRkyDZsh7T-P1GG0HfJY1y19iFn_ln-YDdAqpet7kpfxVcv6IVKrVoOBTsBr2DSQIqSoUDlGhiPr3omFSRbnLEWNEOZ1o2UmITxVTHvq3zcW8U1eneJdIp0SgtVowyJnIUQ5Km8txrCteRNy7jChVdxmB35COFzqOOztOq7ey-7AoD0e1xrobOF07muHkD1VkP2WGRyqPgmHc6O_dC4Tw"
            onClick={() => onScreenChange('welcome')}
          />
          <h1 className="font-sans text-3xl md:text-5xl font-extrabold text-[#561668] mb-2 tracking-tight">
            Avaliação de Estrutura
          </h1>
          <p className="font-sans text-[15px] md:text-base text-[#4e434e] max-w-lg mx-auto leading-relaxed">
            Compreendendo a essência e as necessidades singulares do seu lar para uma curadoria de cuidados especializada.
          </p>
        </div>

        {user && (
          <div className="mb-6 text-center">
            <p className="font-sans text-[13px] italic text-[#703081] font-medium opacity-90 tracking-wide">
              Bem-vinda, {user.displayName}. O seu lar merece o melhor cuidado.
            </p>
          </div>
        )}

        {/* Neumorphic Form Container */}
        <div className="bg-[#fff7fd] rounded-2xl p-6 md:p-12 shadow-[6px_6px_15px_#e0d7e0,-6px_-6px_15px_#ffffff] border border-white/40">
          
          {/* Progress Indicators */}
          <div className="flex justify-between items-center mb-12 px-2">
            <div className="flex items-center space-x-2 w-full">
              {[1, 2, 3, 4].map((stepNum) => (
                <div key={stepNum} className="flex-1 flex items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs tracking-wider transition-all duration-500 z-10 ${
                      step >= stepNum
                        ? 'bg-[#561668] text-white shadow-md'
                        : 'bg-[#f4ebf4] text-[#4e434e] shadow-[inset_2px_2px_4px_#d9cbd9,inset_-2px_-2px_4px_#ffffff]'
                    }`}
                  >
                    {stepNum}
                  </div>
                  {stepNum < 4 && (
                    <div className="flex-1 h-[4px] mx-2 bg-[#f4ebf4] shadow-[inset_1px_1px_2px_#d9cbd9,inset_-1px_-1px_2px_#ffffff] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#561668] transition-all duration-500"
                        style={{
                          width: step > stepNum ? '100%' : '0%',
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Steps */}
          <form onSubmit={handleSubmit} className="relative min-h-[360px] flex flex-col justify-between">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex-col"
                >
                  <h2 className="font-sans text-xl md:text-2xl font-bold text-[#561668] mb-1">
                    Histórico Recente
                  </h2>
                  <p className="font-sans text-sm md:text-[15px] text-[#4e434e] mb-6">
                    Quando ocorreu o último detalhamento profissional ou limpeza profunda na residência?
                  </p>
                  
                  <div className="space-y-3">
                    {[
                      { id: '<7', label: 'Há menos de 7 dias' },
                      { id: '15-30', label: 'Entre 15 e 30 dias' },
                      { id: '>30', label: 'Há mais de 30 dias ou Pós-obra' },
                    ].map((opt) => (
                      <label key={opt.id} className="block cursor-pointer">
                        <input
                          type="radio"
                          name="cleaningDate"
                          checked={triageData.cleaningDate === opt.id}
                          onChange={() => updateField('cleaningDate', opt.id)}
                          className="peer sr-only"
                        />
                        <div className="p-4 rounded-xl border border-transparent peer-checked:border-[#561668]/30 peer-checked:bg-[#faf1fa] bg-[#fff7fd] shadow-[4px_4px_10px_#d9cbd9,-4px_-4px_10px_#ffffff] peer-checked:shadow-[inset_2px_2px_5px_#d9cbd9,inset_-2px_-2px_5px_#ffffff] hover:opacity-90 transition-all duration-200 flex items-center justify-between group">
                          <span className="font-sans text-[15px] font-medium text-[#1e1a20] peer-checked:text-[#561668]">
                            {opt.label}
                          </span>
                          <span className="material-symbols-outlined text-[#d1c2d0] peer-checked:text-[#561668] transition-colors">
                            {triageData.cleaningDate === opt.id ? 'check_circle' : 'circle'}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex-col"
                >
                  <h2 className="font-sans text-xl md:text-2xl font-bold text-[#561668] mb-1">
                    Dimensões do Espaço
                  </h2>
                  <p className="font-sans text-sm md:text-[15px] text-[#4e434e] mb-8">
                    Para dimensionarmos a equipe ideal, informe a volumetria da residência.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { field: 'rooms' as const, label: 'QUARTOS' },
                      { field: 'baths' as const, label: 'BANHEIROS' },
                      { field: 'floors' as const, label: 'ANDARES' },
                    ].map((item) => (
                      <div key={item.field} className="flex flex-col items-center bg-[#fff7fd] p-5 rounded-2xl shadow-[4px_4px_10px_#d9cbd9,-4px_-4px_10px_#ffffff]">
                        <span className="font-sans text-xs font-bold text-[#4e434e] tracking-wider mb-3">
                          {item.label}
                        </span>
                        
                        <div className="flex items-center gap-4 bg-[#f4ebf4] shadow-[inset_2px_2px_5px_#d9cbd9,inset_-2px_-2px_5px_#ffffff] rounded-full p-2">
                          <button
                            type="button"
                            onClick={() => decrement(item.field)}
                            className="w-10 h-10 rounded-full bg-[#fff7fd] hover:bg-[#efe5ee] text-[#561668] flex items-center justify-center transition-all shadow-[2px_2px_5px_#d9cbd9,-2px_-2px_5px_#ffffff] hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[20px] font-bold">remove</span>
                          </button>
                          
                          <span className="font-sans text-lg font-extrabold text-[#561668] w-8 text-center">
                            {triageData[item.field]}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => increment(item.field)}
                            className="w-10 h-10 rounded-full bg-[#fff7fd] hover:bg-[#efe5ee] text-[#561668] flex items-center justify-center transition-all shadow-[2px_2px_5px_#d9cbd9,-2px_-2px_5px_#ffffff] hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[20px] font-bold">add</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex-col"
                >
                  <h2 className="font-sans text-xl md:text-2xl font-bold text-[#561668] mb-1">
                    Superfícies Nobres
                  </h2>
                  <p className="font-sans text-sm md:text-[15px] text-[#4e434e] mb-6">
                    Selecione os acabamentos que demandam produtos e técnicas de conservação específicas.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { field: 'marble' as const, label: 'Mármore e Pedras Naturais' },
                      { field: 'wood' as const, label: 'Madeira Maciça' },
                      { field: 'doubleGlass' as const, label: 'Vidros Duplos ou Grandes Vãos' },
                      { field: 'chandeliers' as const, label: 'Cristais e Lustres de Luxo' },
                    ].map((item) => (
                      <label key={item.field} className="cursor-pointer group">
                        <div
                          className={`flex items-center gap-3 p-4 rounded-xl border bg-[#fff7fd] hover:bg-[#faf1fa] transition-all duration-300 ${
                            triageData[item.field]
                              ? 'border-[#561668]/30 shadow-[inset_2px_2px_4px_#d9cbd9,inset_-2px_-2px_4px_#ffffff]'
                              : 'border-transparent shadow-[4px_4px_8px_#d9cbd9,-4px_-4px_8px_#ffffff]'
                          }`}
                        >
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={triageData[item.field]}
                              onChange={(e) => updateField(item.field, e.target.checked)}
                              className="peer sr-only"
                            />
                            <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                              triageData[item.field] 
                                ? 'bg-[#561668]' 
                                : 'bg-[#fff7fd] shadow-[inset_1px_1px_3px_#d9cbd9,inset_-1px_-1px_3px_#ffffff]'
                            }`}>
                              {triageData[item.field] && (
                                <span className="material-symbols-outlined text-[16px] text-white font-bold">check</span>
                              )}
                            </div>
                          </div>
                          
                          <span className="font-sans text-[14px] md:text-[15px] font-semibold text-[#1e1a20]">
                            {item.label}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex-col"
                >
                  <h2 className="font-sans text-xl md:text-2xl font-bold text-[#561668] mb-1">
                    Frequência Desejada
                  </h2>
                  <p className="font-sans text-sm md:text-[15px] text-[#4e434e] mb-6">
                    Defina como prefere integrar o MÉTODO PAME à rotina da sua residência.
                  </p>

                  <div className="space-y-4">
                    <label className="block cursor-pointer group">
                      <input
                        type="radio"
                        name="frequency"
                        checked={triageData.frequency === 'monthly'}
                        onChange={() => updateField('frequency', 'monthly')}
                        className="peer sr-only"
                      />
                      <div className={`p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
                        triageData.frequency === 'monthly'
                          ? 'border-[#561668]/40 bg-[#faf1fa] shadow-[inset_2px_2px_5px_#d9cbd9,inset_-2px_-2px_5px_#ffffff]'
                          : 'border-transparent bg-[#fff7fd] shadow-[4px_4px_10px_#d9cbd9,-4px_-4px_10px_#ffffff] hover:opacity-90'
                      }`}>
                        <div className="absolute top-0 right-0 bg-[#561668] text-white font-sans text-[10px] font-bold py-1 px-4 rounded-bl-xl uppercase tracking-wider">
                          Recomendado
                        </div>
                        <div className="flex items-start gap-4">
                          <span className={`material-symbols-outlined text-3xl mt-1 transition-colors ${
                            triageData.frequency === 'monthly' ? 'text-[#561668]' : 'text-[#d1c2d0]'
                          }`}>all_inclusive</span>
                          <div>
                            <h3 className={`font-sans text-[16px] font-extrabold mb-1 transition-colors ${
                              triageData.frequency === 'monthly' ? 'text-[#561668]' : 'text-[#1e1a20]'
                            }`}>
                              Pacote Mensal de Curadoria
                            </h3>
                            <p className="font-sans text-xs md:text-sm text-[#4e434e] leading-relaxed">
                              Manutenção contínua e previsível. Nossa equipe gerencia cronogramas de limpeza profunda, conservação de materiais nobres e organização diária.
                            </p>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="block cursor-pointer group">
                      <input
                        type="radio"
                        name="frequency"
                        checked={triageData.frequency === 'individual'}
                        onChange={() => updateField('frequency', 'individual')}
                        className="peer sr-only"
                      />
                      <div className={`p-5 rounded-2xl border transition-all duration-200 ${
                        triageData.frequency === 'individual'
                          ? 'border-[#561668]/40 bg-[#faf1fa] shadow-[inset_2px_2px_5px_#d9cbd9,inset_-2px_-2px_5px_#ffffff]'
                          : 'border-transparent bg-[#fff7fd] shadow-[4px_4px_10px_#d9cbd9,-4px_-4px_10px_#ffffff] hover:opacity-90'
                      }`}>
                        <div className="flex items-start gap-4">
                          <span className={`material-symbols-outlined text-3xl mt-1 transition-colors ${
                            triageData.frequency === 'individual' ? 'text-[#561668]' : 'text-[#d1c2d0]'
                          }`}>
                            event
                          </span>
                          <div>
                            <h3 className={`font-sans text-[16px] font-extrabold mb-1 transition-colors ${
                              triageData.frequency === 'individual' ? 'text-[#561668]' : 'text-[#1e1a20]'
                            }`}>
                              Serviço Individual
                            </h3>
                            <p className="font-sans text-xs md:text-sm text-[#4e434e] leading-relaxed">
                              Intervenção pontual para preparo de eventos, retornos de viagem ou restauração profunda da ordem sob demanda.
                            </p>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Actions */}
            <div className="mt-10 pt-6 border-t border-[#d1c2d0]/30 flex justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-6 py-3 rounded-xl bg-[#fff7fd] hover:bg-[#efe5ee] text-[#4e434e] font-sans text-xs font-bold tracking-wider uppercase transition-all duration-200 flex items-center gap-2 shadow-[3px_3px_6px_#d9cbd9,-3px_-3px_6px_#ffffff] active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Voltar
                </button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 rounded-xl bg-[#561668] hover:opacity-90 text-white font-sans text-xs font-bold tracking-wider uppercase transition-all duration-200 flex items-center gap-2 hover:shadow-[4px_4px_10px_rgba(86,22,104,0.15)] active:scale-95 cursor-pointer"
                >
                  Continuar
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              ) : (
                <div className="flex gap-4">
                  {!user && (
                    <button
                      type="button"
                      disabled={isLoggingIn}
                      onClick={async () => {
                        try {
                          setIsLoggingIn(true);
                          const result = await signInWithGoogle();
                          if (result?.user) {
                            await setDoc(doc(db, 'users', result.user.uid, 'profile', 'triage'), triageData);
                          }
                        } catch (err) {
                          console.error("Login failed:", err);
                        } finally {
                          setIsLoggingIn(false);
                        }
                      }}
                      className="px-6 py-3 rounded-xl bg-white text-[#561668] border border-[#d1c2d0]/50 hover:bg-[#faf1fa] font-sans text-[10px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                      {isLoggingIn ? 'Salvando...' : 'Salvar Progresso'}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting || triageData.frequency === ''}
                    className="px-6 py-3 rounded-xl bg-[#561668] hover:bg-[#703081] text-white font-sans text-xs font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                        Processando...
                      </>
                    ) : (
                      <>
                        Concluir Avaliação
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </form>

        </div>
      </div>
    </main>
  );
}
