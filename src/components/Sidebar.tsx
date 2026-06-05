/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApplicationScreen } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentScreen: ApplicationScreen;
  onScreenChange: (screen: ApplicationScreen) => void;
}

export default function Sidebar({ currentScreen, onScreenChange }: SidebarProps) {
  const { user } = useAuth();

  const navItems = [
    { id: 'welcome', label: 'Home Detail', icon: 'home_pin' },
    { id: 'triage', label: 'Avaliação da Residência', icon: 'assignment_ind' },
    { id: 'pricing', label: 'Pricing', icon: 'payments' },
    ...(user ? [{ id: 'minha-area', label: 'Minha Área', icon: 'person' }] : []),
  ] as const;

  return (
    <nav className="hidden md:flex flex-col p-6 h-full bg-[#faf1fa] shadow-[inset_-2px_0_10px_rgba(112,48,129,0.03)] w-72 flex-shrink-0 z-40 relative">
      <div className="mb-14">
        <img
          alt="METODO PAME"
          className="h-16 w-auto mb-3 cursor-pointer object-contain hover:opacity-90"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJul2j80hhyNHenR0y3YscP1-t9rYnu_EqX3FaOMN3WGZIujzQSchb9q9SRkyDZsh7T-P1GG0HfJY1y19iFn_ln-YDdAqpet7kpfxVcv6IVKrVoOBTsBr2DSQIqSoUDlGhiPr3omFSRbnLEWNEOZ1o2UmITxVTHvq3zcW8U1eneJdIp0SgtVowyJnIUQ5Km8txrCteRNy7jChVdxmB35COFzqOOztOq7ey-7AoD0e1xrobOF07muHkD1VkP2WGRyqPgmHc6O_dC4Tw"
          onClick={() => onScreenChange('welcome')}
        />
        <div className="font-sans text-[11px] font-semibold text-[#4e434e] tracking-[0.2em] uppercase ml-1">
          High-End Home Detail
        </div>
      </div>
      
      <ul className="flex flex-col gap-2 flex-1">
        {navItems.map((item) => {
          const isActive = currentScreen === item.id;
          return (
            <li key={item.id}>
              <button
                id={`sidebar-nav-${item.id}`}
                onClick={() => onScreenChange(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left cursor-pointer font-sans ${
                  isActive
                    ? 'bg-[#703081] text-white shadow-md font-bold transform translate-x-1'
                    : 'text-[#4e434e] hover:bg-[#efe5ee] hover:text-[#561668] font-medium'
                }`}
              >
                <span 
                  className="material-symbols-outlined text-[22px]"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span className="text-[14px] tracking-wide">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="pt-6 border-t border-[#d1c2d0]/30">
        <p className="text-[10px] text-[#4e434e] opacity-70 tracking-widest font-sans uppercase">
          Método Pame • SC
        </p>
      </div>
    </nav>
  );
}
