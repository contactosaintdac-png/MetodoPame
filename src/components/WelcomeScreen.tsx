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
    <div className="relative h-screen w-screen overflow-hidden flex flex-col md:flex-row font-sans selection:bg-[#561668] selection:text-white">
      
      {/* Login / Dashboard Button - Top Right */}
      <div className="absolute top-6 right-6 z-40">
        <button
          onClick={handleLoginClick}
          disabled={isLoggingIn}
          className="flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-md hover:bg-white border border-[#efe5ee] rounded-full shadow-[2px_2px_8px_rgba(112,48,129,0.1)] transition-all text-[#561668] font-bold text-[11px] tracking-widest uppercase cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">
            {user ? 'person' : 'login'}
          </span>
          {user ? 'Minha Área' : (isLoggingIn ? 'Entrando...' : 'Já sou cliente')}
        </button>
      </div>

      {/* Central Brand Badge */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center">
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
        onClick={() => onScreenChange('triage')}
        className="flex-1 h-1/2 md:h-full relative overflow-hidden group cursor-pointer border-b md:border-b-0 md:border-r border-[#efe5ee]/40"
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
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-14 lg:p-20 z-10">
          <motion.div 
            whileHover={{ y: -4 }}
            className="max-w-md bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/50 shadow-[10px_10px_20px_#d1c2d0,-10px_-10px_20px_#ffffff]"
          >
            <div className="w-12 h-12 rounded-full bg-[#fff7fd] flex items-center justify-center p-2 shadow-[2px_2px_6px_#d1c2d0,-2px_-2px_6px_#ffffff] mb-5">
              <span 
                className="material-symbols-outlined text-[#561668] text-2xl font-bold"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                home_pin
              </span>
            </div>
            
            <h2 className="font-sans text-2xl md:text-3xl font-extrabold text-[#561668] tracking-tight mb-2">
              Para Residências
            </h2>
            <p className="font-sans text-[15px] md:text-[17px] text-[#4e434e] mb-6 leading-relaxed">
              Quero contratar o Método Pame para a minha residência e garantir excelência e cuidado contínuo.
            </p>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onScreenChange('triage');
              }}
              className="w-full py-4 px-6 bg-[#fff7fd] hover:bg-[#efe5ee] text-[#561668] border border-[#d1c2d0]/30 rounded-xl font-bold text-xs tracking-widest uppercase transition-all duration-300 shadow-[4px_4px_8px_#d9cbd9,-4px_-4px_8px_#ffffff] hover:shadow-[inset_2px_2px_5px_#d9cbd9,inset_-2px_-2px_5px_#ffffff] active:scale-98 flex items-center justify-center gap-2"
            >
              Iniciar Avaliação
              <span className="material-symbols-outlined text-[16px] font-bold">arrow_forward</span>
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
        className="flex-1 h-1/2 md:h-full relative overflow-hidden group cursor-pointer"
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
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-14 lg:p-20 z-10 md:items-end">
          <motion.div 
            whileHover={{ y: -4 }}
            className="max-w-md bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/50 shadow-[10px_10px_20px_#d1c2d0,-10px_-10px_20px_#ffffff] flex flex-col md:items-end text-left md:text-right"
          >
            <div className="w-12 h-12 rounded-full bg-[#fff7fd] flex items-center justify-center p-2 shadow-[2px_2px_6px_#d1c2d0,-2px_-2px_6px_#ffffff] mb-5">
              <span 
                className="material-symbols-outlined text-[#561668] text-2xl font-bold"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                stars
              </span>
            </div>
            
            <h2 className="font-sans text-2xl md:text-3xl font-extrabold text-[#561668] tracking-tight mb-2">
              Para Especialistas
            </h2>
            <p className="font-sans text-[15px] md:text-[17px] text-[#4e434e] mb-6 leading-relaxed">
              Quero fazer parte da renomada equipe de cuidadoras e especialistas do Método Pame.
            </p>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onScreenChange('recruitment');
              }}
              className="w-full py-4 px-6 bg-[#fff7fd] hover:bg-[#efe5ee] text-[#561668] border border-[#d1c2d0]/30 rounded-xl font-bold text-xs tracking-widest uppercase transition-all duration-300 shadow-[4px_4px_8px_#d9cbd9,-4px_-4px_8px_#ffffff] hover:shadow-[inset_2px_2px_5px_#d9cbd9,inset_-2px_-2px_5px_#ffffff] active:scale-98 flex items-center justify-center gap-2 md:flex-row-reverse"
            >
              Inicie sua Jornada
              <span className="material-symbols-outlined text-[16px] font-bold md:rotate-180">arrow_forward</span>
            </button>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer Branding overlay */}
      <footer className="absolute bottom-0 w-full py-5 px-10 flex justify-between items-center z-30 pointer-events-none">
        <span className="text-[10px] font-extrabold text-[#4e434e] tracking-[0.3em] uppercase opacity-70">
          MÉTODO PAME
        </span>
        <span className="text-[10px] font-extrabold text-[#4e434e] tracking-[0.3em] uppercase hidden md:block opacity-70">
          HIGH-END HOME DETAIL
        </span>
      </footer>
    </div>
  );
}
