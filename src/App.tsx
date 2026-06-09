/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ApplicationScreen, TriageData } from './types';
import { INITIAL_TRIAGE_DATA } from './data';
import WelcomeScreen from './components/WelcomeScreen';
import ClientTriage from './components/ClientTriage';
import PricingMatrix from './components/PricingMatrix';
import RecruitmentForm from './components/RecruitmentForm';
import Sidebar from './components/Sidebar';
import MinhaArea from './components/MinhaArea';
import AdminPanel from './components/AdminPanel';
import { useAuth } from './contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';

const getInitialScreen = (): ApplicationScreen => {
  const path = window.location.pathname;
  if (path === '/equipe') return 'recruitment';
  if (path === '/admin')  return 'admin';
  if (path === '/minha-area') return 'minha-area';
  if (path === '/pricing') return 'pricing';
  if (path === '/triage')  return 'triage';
  return 'welcome';
};

const ADMIN_EMAILS = ['metodopame.homedetail@gmail.com', 'contactosaintdac@gmail.com'];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ApplicationScreen>(getInitialScreen);
  const [triageData, setTriageData] = useState<TriageData>(INITIAL_TRIAGE_DATA);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();
  const [userRole, setUserRole] = useState<'client' | 'specialist' | 'admin' | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // Determine user role when authentication status resolves
  useEffect(() => {
    if (loading) return;

    if (!user) {
      setUserRole(null);
      setRoleLoading(false);
      return;
    }

    const determineRole = async () => {
      try {
        setRoleLoading(true);
        if (user.email && ADMIN_EMAILS.includes(user.email)) {
          setUserRole('admin');
          setRoleLoading(false);
          return;
        }

        if (user.email) {
          const q = query(
            collection(db, 'employees'),
            where('email', '==', user.email),
            where('status', '==', 'active')
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setUserRole('specialist');
            setRoleLoading(false);
            return;
          }
        }

        setUserRole('client');
      } catch (err) {
        console.error('Error determining user role:', err);
        setUserRole('client'); // fallback
      } finally {
        setRoleLoading(false);
      }
    };

    determineRole();
  }, [user, loading]);

  // Route protection and redirection based on roles
  useEffect(() => {
    if (loading || roleLoading) return;

    // 1. Specialist: Force to /equipe (recruitment screen) and block client views
    if (userRole === 'specialist') {
      if (currentScreen !== 'recruitment') {
        handleScreenChange('recruitment');
      }
      return;
    }

    // 2. Client / Guest: Block admin screen
    if (userRole === 'client' || !user) {
      if (currentScreen === 'admin') {
        handleScreenChange('welcome');
        return;
      }
    }

    // 3. Guest protections
    if (!user) {
      if (currentScreen === 'minha-area') {
        handleScreenChange('welcome');
        return;
      }
    }

    // 4. Client pricing flow protection
    if (currentScreen === 'pricing' && triageData.frequency === '') {
      handleScreenChange('welcome');
      return;
    }
  }, [currentScreen, user, userRole, loading, roleLoading, triageData.frequency]);

  // Load existing triage data for authenticated clients
  useEffect(() => {
    if (!loading && !roleLoading && user && userRole === 'client') {
      getDoc(doc(db, 'users', user.uid, 'profile', 'triage')).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data() as TriageData;
          setTriageData(data);
          if (currentScreen === 'welcome' || currentScreen === 'triage') {
            setTimeout(() => handleScreenChange('minha-area'), 50);
          }
        }
      }).catch(err => console.error('Error loading triage:', err));
    }
  }, [user, loading, roleLoading, userRole]);

  const handleScreenChange = (screen: ApplicationScreen) => {
    // Isolated routes: once in recruitment or admin you stay there
    if (currentScreen === 'recruitment' && screen !== 'recruitment') return;
    if (currentScreen === 'admin' && screen !== 'admin') return;

    setCurrentScreen(screen);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const paths: Record<ApplicationScreen, string> = {
      welcome:      '/',
      triage:       '/triage',
      pricing:      '/pricing',
      recruitment:  '/equipe',
      'minha-area': '/minha-area',
      admin:        '/admin',
    };
    window.history.pushState({}, '', paths[screen] || '/');
  };
  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-screen bg-[#fff7fd]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[#561668] shadow-lg">
            <span className="material-symbols-outlined text-white text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>diamond</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 150, 300].map(delay => (
              <span key={delay} className="w-2 h-2 rounded-full bg-[#561668] animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff7fd] text-[#1e1a20] font-sans antialiased flex flex-col md:flex-row relative">

      {/* ── Completely Isolated Routes ── */}
      {currentScreen === 'recruitment' ? (
        <div className="w-full h-screen overflow-y-auto bg-[#fff7fd]">
          <RecruitmentForm onScreenChange={() => {}} />
        </div>

      ) : currentScreen === 'admin' ? (
        <div className="w-full h-screen overflow-y-auto bg-[#f8f9fa]">
          <AdminPanel onScreenChange={() => {}} />
        </div>

      ) : currentScreen === 'welcome' ? (
        <WelcomeScreen onScreenChange={handleScreenChange} />

      ) : currentScreen === 'triage' ? (
        <ClientTriage
          triageData={triageData}
          onTriageDataChange={setTriageData}
          onScreenChange={handleScreenChange}
        />

      ) : currentScreen === 'minha-area' ? (
        <div className="w-full h-screen overflow-y-auto bg-[#fff7fd]">
          <MinhaArea onScreenChange={handleScreenChange} />
        </div>

      ) : (
        /* Standard Layout — client flow */
        <>
          <Sidebar currentScreen={currentScreen} onScreenChange={handleScreenChange} />

          {/* Mobile Header */}
          <header className="md:hidden fixed top-0 left-0 w-full z-50 bg-[#fff7fd]/90 backdrop-blur-md border-b border-[#efe5ee] flex justify-between items-center px-6 py-4 h-[72px]">
            <img
              alt="METODO PAME"
              className="h-10 w-auto cursor-pointer object-contain"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBJul2j80hhyNHenR0y3YscP1-t9rYnu_EqX3FaOMN3WGZIujzQSchb9q9SRkyDZsh7T-P1GG0HfJY1y19iFn_ln-YDdAqpet7kpfxVcv6IVKrVoOBTsBr2DSQIqSoUDlGhiPr3omFSRbnLEWNEOZ1o2UmITxVTHvq3zcW8U1eneJdIp0SgtVowyJnIUQ5Km8txrCteRNy7jChVdxmB35COFzqOOztOq7ey-7AoD0e1xrobOF07muHkD1VkP2WGRyqPgmHc6O_dC4Tw"
              onClick={() => handleScreenChange('welcome')}
            />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#faf1fa] shadow-[2px_2px_5px_rgba(112,48,129,0.1),-2px_-2px_5px_#ffffff] text-[#561668] active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined font-bold">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>

            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-[72px] left-0 w-full bg-[#faf1fa] shadow-xl border-b border-[#efe5ee] py-5 px-6 flex flex-col gap-3 z-50"
                >
                  {[
                    ...(user ? [] : [{ id: 'welcome', label: 'Home Detail', icon: 'home_pin' }]),
                    ...(user ? [] : [{ id: 'triage', label: 'Avaliação da Residência', icon: 'assignment_ind' }]),
                    { id: 'pricing', label: 'Pricing Matrix', icon: 'payments' },
                    ...(user ? [{ id: 'minha-area', label: 'Minha Área', icon: 'person' }] : []),
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleScreenChange(item.id as ApplicationScreen)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left font-bold text-sm tracking-wide transition-all ${
                        currentScreen === item.id
                          ? 'bg-[#703081] text-white'
                          : 'text-[#4e434e] hover:bg-[#efe5ee]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </header>

          <main className="flex-1 overflow-y-auto max-h-screen pt-[72px] md:pt-0 bg-[#fff7fd]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentScreen}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full h-full flex"
              >
                {currentScreen === 'pricing' && (
                  <PricingMatrix triageData={triageData} onTriageDataChange={setTriageData} onScreenChange={handleScreenChange} />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </>
      )}
    </div>
  );
}
