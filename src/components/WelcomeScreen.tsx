/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { ApplicationScreen } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface WelcomeScreenProps {
  onScreenChange: (screen: ApplicationScreen) => void;
}

export default function WelcomeScreen({ onScreenChange }: WelcomeScreenProps) {
  const { user, signInWithGoogle } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLoginClick = async () => {
    try {
      setIsLoggingIn(true);
      
      let targetUser = user;
      if (!targetUser) {
        const { user: authUser } = await signInWithGoogle();
        targetUser = authUser;
      }
      
      // Verificamos si el usuario tiene reservas
      const q = query(collection(db, 'users', targetUser.uid, 'bookings'), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        onScreenChange('triage');
      } else {
        onScreenChange('minha-area');
      }
    } catch (error) {
      console.error("Login falhou:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden flex flex-col md:flex-row font-sans selection:bg-[#561668] selection:text-white">
      
      {/* Hidden H1 for SEO */}
      <h1 className="sr-only">Método Pame - Home Detail | Serviços Residenciais de Alto Padrão</h1>

      {/* Mobile-Only Header Brand (Top Center) */}
      <div className="md:hidden absolute top-5 left-5 z-40 flex items-center gap-2">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-white shadow-lg border border-[#efe5ee]">
          <img
            alt="Logo Método Pame"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn"
          />
        </div>
      </div>

      {/* Login / Dashboard Button - Top Right */}
      <div className="absolute top-5 right-5 z-40">
        <button
          onClick={handleLoginClick}
          disabled={isLoggingIn}
          className="flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-white/90 backdrop-blur-md hover:bg-white border border-[#efe5ee] rounded-full shadow-[2px_2px_8px_rgba(112,48,129,0.15)] transition-all text-[#561668] font-bold text-[10px] md:text-[11px] tracking-widest uppercase cursor-pointer disabled:opacity-50 active-scale"
        >
          <span className="material-symbols-outlined text-[16px] md:text-[16px]">
            {user ? 'person' : 'login'}
          </span>
          <span className="hidden sm:inline">
            {user ? 'Minha Área' : (isLoggingIn ? 'Entrando...' : 'Já sou cliente')}
          </span>
          <span className="sm:hidden">
            {user ? 'Área' : (isLoggingIn ? '...' : 'Cliente')}
          </span>
        </button>
      </div>

      {/* Central Brand Badge - Hidden on mobile to let elements breathe */}
      <div className="hidden md:flex absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex-col items-center justify-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-40 h-40 rounded-full bg-[#fff7fd] flex items-center justify-center p-2 border border-[#efe5ee]/60 shadow-[4px_4px_12px_rgba(112,48,129,0.1),-4px_-4px_12px_#ffffff]"
        >
          <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden shadow-[inset_2px_2px_6px_rgba(112,48,129,0.08),inset_-2px_-2px_6px_#ffffff]">
            <img
              alt="Logo Método Pame"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn"
            />
          </div>
        </motion.div>
      </div>

      {/* Left Side: Clients (Para Residências) */}
      <motion.section 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        onClick={() => onScreenChange('waitlist')}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onScreenChange('waitlist');
          }
        }}
        className="flex-1 h-1/2 md:h-full relative overflow-hidden group cursor-pointer border-b md:border-b-0 md:border-r border-[#efe5ee]/40 focus:outline-none focus:ring-2 focus:ring-[#561668] focus:z-30"
      >
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[1200ms] group-hover:scale-105"
          style={{
            backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCoLW68wbvAjse644cH0JNIVMP7dU83QBIlmg3V73bDr44z2aGn8lStNlwfyJx_8mOEbZuM9_TCQQfRkG90juYVXmY9tYxHg8sEHV35r1OYPct7suWcezPLoSST6Q7xPjEIRcxEJ_4NpbrulgktZaPTI0SpXwXvElixLO17pbpiULheiqcL-C4syAWBS8lcK8cbKsa7KCC_YukE4iXYfn0xle-F6en3DPqboFiweXzpHPH8lxTpwctZXynCOrsuDlCuYWs_0xTXM_4_')`
          }}
        />
        {/* Gradient Overlay for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#fff7fd] via-[#fff7fd]/40 to-transparent md:bg-gradient-to-r md:from-[#fff7fd]/80 md:via-[#fff7fd]/30 md:to-transparent" />

        {/* Content Card */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 pb-8 md:p-14 lg:p-20 z-10">
          <motion.div 
            whileHover={{ y: -4 }}
            className="max-w-md w-full mx-auto md:mx-0 bg-white/80 backdrop-blur-xl p-7 md:p-8 rounded-3xl border border-white/50 shadow-[10px_10px_20px_#d1c2d0,-10px_-10px_20px_#ffffff]"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#fff7fd] flex items-center justify-center p-2 shadow-[2px_2px_6px_#d1c2d0,-2px_-2px_6px_#ffffff] mb-3 md:mb-5">
              <span 
                className="material-symbols-outlined text-[#561668] text-xl md:text-2xl font-bold"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                home_pin
              </span>
            </div>
            
            <h2 className="font-display italic text-3xl md:text-4xl font-semibold text-[#561668] tracking-tight mb-2 md:mb-3">
              Para Residências
            </h2>
            <p className="font-sans text-[14px] md:text-[17px] text-[#4e434e] mb-5 md:mb-6 leading-relaxed">
              Garanta sua vaga na lista de espera para o lançamento oficial do agendamento online do Método Pame.
            </p>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onScreenChange('waitlist');
              }}
              className="w-full py-3.5 md:py-4 px-6 bg-[#fff7fd] hover:bg-[#efe5ee] text-[#561668] border border-[#d1c2d0]/30 rounded-2xl font-bold text-[10px] md:text-xs tracking-widest uppercase transition-all duration-300 shadow-[4px_4px_8px_#d9cbd9,-4px_-4px_8px_#ffffff] hover:shadow-[inset_2px_2px_5px_#d9cbd9,inset_-2px_-2px_5px_#ffffff] active-scale flex items-center justify-center gap-2"
            >
              Entrar na Lista de Espera
              <span className="material-symbols-outlined text-[16px] md:text-[18px] font-bold">arrow_forward</span>
            </button>
          </motion.div>
        </div>
      </motion.section>

      {/* Right Side: Staff (Para Especialistas) */}
      <motion.section 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        onClick={() => onScreenChange('recruitment')}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onScreenChange('recruitment');
          }
        }}
        className="flex-1 h-1/2 md:h-full relative overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#561668] focus:z-30"
      >
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[1200ms] group-hover:scale-105"
          style={{
            backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCqlcrzl3IheWvPxxJIlvJCzWEfHzwwTJIFjwqurucqA_-pQvkuoJPvIs75KKEjKyAdxTpzciACG3cRmdYC2exVFcv5jvdRGZuZP--mXrFiRD4g8bZLQAZxr2YnWgjepRzWIna-6OMkCVuS3gU2lvkquij7xKyabPtn7M7ZAEfH2jnsFsQzXzXtm4jceiMdk2oqmKcdodMULRNAzvh74-UNCptqi7goh3Oa5vEpbf4nKjpd1EHErKw_6XgAhP2iguvS2EdtLbwKPTgz')`
          }}
        />
        {/* Gradient Overlay for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#fff7fd] via-[#fff7fd]/40 to-transparent md:bg-gradient-to-l md:from-[#fff7fd]/80 md:via-[#fff7fd]/30 md:to-transparent" />

        {/* Content Card */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 pb-8 md:p-14 lg:p-20 z-10 md:items-end">
          <motion.div 
            whileHover={{ y: -4 }}
            className="max-w-md w-full mx-auto md:mx-0 bg-white/80 backdrop-blur-xl p-7 md:p-8 rounded-3xl border border-white/50 shadow-[10px_10px_20px_#d1c2d0,-10px_-10px_20px_#ffffff] flex flex-col md:items-end text-left md:text-right"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#fff7fd] flex items-center justify-center p-2 shadow-[2px_2px_6px_#d1c2d0,-2px_-2px_6px_#ffffff] mb-3 md:mb-5">
              <span 
                className="material-symbols-outlined text-[#561668] text-xl md:text-2xl font-bold"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                stars
              </span>
            </div>
            
            <h2 className="font-display italic text-3xl md:text-4xl font-semibold text-[#561668] tracking-tight mb-2 md:mb-3">
              Para Especialistas
            </h2>
            <p className="font-sans text-[14px] md:text-[17px] text-[#4e434e] mb-5 md:mb-6 leading-relaxed">
              Quero fazer parte da renomada equipe de cuidadoras e especialistas do Método Pame.
            </p>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onScreenChange('recruitment');
              }}
              className="w-full py-3.5 md:py-4 px-6 bg-[#fff7fd] hover:bg-[#efe5ee] text-[#561668] border border-[#d1c2d0]/30 rounded-2xl font-bold text-[10px] md:text-xs tracking-widest uppercase transition-all duration-300 shadow-[4px_4px_8px_#d9cbd9,-4px_-4px_8px_#ffffff] hover:shadow-[inset_2px_2px_5px_#d9cbd9,inset_-2px_-2px_5px_#ffffff] active-scale flex items-center justify-center gap-2 md:flex-row-reverse"
            >
              Inicie sua Jornada
              <span className="material-symbols-outlined text-[16px] md:text-[18px] font-bold md:rotate-180">arrow_forward</span>
            </button>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer Branding & Legal links */}
      <footer className="absolute bottom-0 w-full py-5 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-3 z-30 text-[10px] font-extrabold text-[#4e434e] tracking-wider uppercase">
        <span className="opacity-70 pointer-events-none">
          MÉTODO PAME · HIGH-END HOME DETAIL
        </span>
        <div className="flex gap-4 text-[#80737f] tracking-widest font-bold">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-privacy-modal'))}
            className="hover:text-[#561668] transition-colors cursor-pointer"
          >
            Privacidade
          </button>
          <span>·</span>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-terms-modal'))}
            className="hover:text-[#561668] transition-colors cursor-pointer"
          >
            Termos
          </button>
        </div>
      </footer>
    </div>
  );
}
