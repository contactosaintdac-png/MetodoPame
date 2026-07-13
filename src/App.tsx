/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ApplicationScreen, TriageData } from './types';
import { INITIAL_TRIAGE_DATA } from './data';
import WelcomeScreen from './components/WelcomeScreen';
import WaitlistForm from './components/WaitlistForm';
import ClientTriage from './components/ClientTriage';
import PricingMatrix from './components/PricingMatrix';
import RecruitmentForm from './components/RecruitmentForm';
import Sidebar from './components/Sidebar';
import MinhaArea from './components/MinhaArea';
import AdminPanel from './components/AdminPanel';
import NotFound from './components/NotFound';
import VerifyCertificate from './components/VerifyCertificate';
import { useAuth } from './contexts/AuthContext';
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './lib/firebase';

const getInitialScreen = (): ApplicationScreen => {
  const path = window.location.pathname;
  if (path === '/' || path === '') return 'welcome';
  if (path === '/equipe') return 'recruitment';
  if (path === '/admin')  return 'admin';
  if (path === '/minha-area') return 'minha-area';
  if (path === '/pricing') return 'pricing';
  if (path === '/avaliacao')  return 'triage';
  if (path === '/lista' || path === '/waitlist') return 'waitlist';
  if (path.startsWith('/verificar-certificado')) return 'verify-certificate';
  return 'not-found';
};

const FOUNDER_EMAILS = ['metodopame.homedetail@gmail.com', 'contactosaintdac@gmail.com'];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ApplicationScreen>(getInitialScreen);
  const [triageData, setTriageData] = useState<TriageData>(INITIAL_TRIAGE_DATA);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();
  const [userRole, setUserRole] = useState<'client' | 'specialist' | 'admin' | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Global event listeners to open legal modals from any sub-component without prop-drilling
  useEffect(() => {
    const handleOpenPrivacy = () => setShowPrivacyModal(true);
    const handleOpenTerms = () => setShowTermsModal(true);

    window.addEventListener('open-privacy-modal', handleOpenPrivacy);
    window.addEventListener('open-terms-modal', handleOpenTerms);

    return () => {
      window.removeEventListener('open-privacy-modal', handleOpenPrivacy);
      window.removeEventListener('open-terms-modal', handleOpenTerms);
    };
  }, []);
 
  // Capture referral code if present in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('pame_referrer_uid', ref);
      params.delete('ref');
      const cleanSearch = params.toString();
      const newPath = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '');
      window.history.replaceState({}, '', newPath);
    }
  }, []);

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
        
        // 1. Check admin status via Firestore or Founder list
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if ((userSnap.exists() && userSnap.data().role === 'admin') || (user.email && FOUNDER_EMAILS.includes(user.email))) {
          if (!userSnap.exists() || userSnap.data().role !== 'admin') {
            await setDoc(userRef, { email: user.email, role: 'admin' }, { merge: true });
          }
          setUserRole('admin');
          setRoleLoading(false);
          return;
        }

        // 2. Check for active specialist
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
        await setDoc(userRef, {
          email: user.email,
          name: user.displayName || 'Cliente Método Pame',
          photoURL: user.photoURL || null,
          role: 'client',
          lastLoginAt: serverTimestamp()
        }, { merge: true });
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

    // 0. Admin: Redirect to admin panel if on welcome/home
    if (userRole === 'admin' && user) {
      if (currentScreen === 'welcome') {
        handleScreenChange('admin');
      }
      return;
    }

    // 1. Specialist: Force to /equipe (recruitment screen) and block client views
    if (userRole === 'specialist' && user) {
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
    if (currentScreen === 'pricing' && triageData.frequency === '' && !user) {
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
          if (currentScreen === 'welcome') {
            setTimeout(() => handleScreenChange('minha-area'), 50);
          }
        } else {
          // If the client has no triage data yet, redirect to triage from welcome/home screen
          if (currentScreen === 'welcome') {
            setTimeout(() => handleScreenChange('triage'), 50);
          }
        }
      }).catch(err => console.error('Error loading triage:', err));
    }
  }, [user, loading, roleLoading, userRole, currentScreen]);

  const handleScreenChange = (screen: ApplicationScreen) => {
    // Isolated routes: once in recruitment or admin you stay there, unless logging out/going back to welcome
    if (currentScreen === 'recruitment' && screen !== 'recruitment' && screen !== 'welcome') return;
    if (currentScreen === 'admin' && screen !== 'admin' && screen !== 'welcome') return;

    setCurrentScreen(screen);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const paths: Record<ApplicationScreen, string> = {
      welcome:      '/',
      triage:       '/avaliacao',
      pricing:      '/pricing',
      recruitment:  '/equipe',
      'minha-area': '/minha-area',
      admin:        '/admin',
      waitlist:     '/lista',
      'not-found':  '/404',
      'verify-certificate': '/verificar-certificado'
    };
    window.history.pushState({}, '', paths[screen] || '/');
  };
  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-screen bg-[#fff7fd]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white border border-[#efe5ee] shadow-lg overflow-hidden">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn" 
              alt="Logo Método Pame" 
              className="w-10 h-10 object-cover"
            />
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
          <AdminPanel onScreenChange={handleScreenChange} />
        </div>

      ) : currentScreen === 'welcome' ? (
        <WelcomeScreen onScreenChange={handleScreenChange} />

      ) : currentScreen === 'waitlist' ? (
        <div className="w-full h-screen overflow-y-auto bg-[#fff7fd]">
          <WaitlistForm onScreenChange={handleScreenChange} />
        </div>

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

      ) : currentScreen === 'verify-certificate' ? (
        <div className="w-full min-h-screen bg-[#fff7fd]">
          <VerifyCertificate onBackToApp={() => handleScreenChange('welcome')} />
        </div>

      ) : currentScreen === 'not-found' ? (
        <NotFound onScreenChange={handleScreenChange} />

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

      {/* Global Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-[#1e1a20]/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in animate-duration-200">
          <div className="silk-lift rounded-3xl w-full max-w-2xl bg-white overflow-hidden max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-[#efe5ee] flex justify-between items-center bg-[#561668] text-white">
              <h3 className="font-display italic text-xl font-semibold">Política de Privacidade</h3>
              <button onClick={() => setShowPrivacyModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-xs md:text-sm text-[#4e434e] leading-relaxed space-y-4 font-sans select-text custom-scroll">
              <p className="font-bold text-[#561668] text-sm md:text-base font-display">POLÍTICA DE PRIVACIDADE — MÉTODO PAME</p>
              <p>Esta Política de Privacidade descreve como o <strong>Método Pame</strong> coleta, usa e protege seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) no Brasil.</p>
              
              <div>
                <p className="font-bold text-[#561668] uppercase tracking-wider text-[10px] md:text-xs">1. Controladora de Dados</p>
                <p className="mt-1">Pamela Mota, fundadora do Método Pame, inscrita em Tijucas/SC, é a controladora de dados responsável pelo tratamento de suas informações pessoais. Contato oficial: <a href="mailto:metodopame.homedetail@gmail.com" className="text-[#561668] underline font-bold">metodopame.homedetail@gmail.com</a>.</p>
              </div>

              <div>
                <p className="font-bold text-[#561668] uppercase tracking-wider text-[10px] md:text-xs">2. Quais Dados Coletamos</p>
                <p className="mt-1">Coletamos as seguintes informações essenciais de acordo com o seu perfil de uso:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li><strong>Clientes:</strong> Nome, e-mail, telefone/WhatsApp, endereço completo de atendimento, características físicas do espaço (cômodos, quantidade de andares, superfícies nobres) obtidas na Avaliação da Residência, e dados de transação financeira (processados de forma 100% segura e encriptada através do Mercado Pago).</li>
                  <li><strong>Especialistas (Candidatas):</strong> Nome completo, data de nascimento, CPF, telefone/WhatsApp, foto de identificação profissional, histórico e referências verificáveis de experiência e comprovante de antecedentes criminais.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-[#561668] uppercase tracking-wider text-[10px] md:text-xs">3. Finalidade do Tratamento</p>
                <p className="mt-1">Utilizamos seus dados estritamente para as seguintes finalidades legítimas:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Viabilizar o agendamento de serviços de limpeza e curadoria residencial de alto padrão.</li>
                  <li>Processar pagamentos e gerar faturas válidas.</li>
                  <li>Atribuir a especialista adequada com base no load balancing automático e na área geográfica.</li>
                  <li>Enviar notificações importantes sobre o status da reserva, lembretes de visitas ou alteração de escala.</li>
                  <li>Garantir a segurança patrimonial e física do ecossistema Método Pame por meio de checagem documental.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-[#561668] uppercase tracking-wider text-[10px] md:text-xs">4. Compartilhamento de Dados</p>
                <p className="mt-1">Seus dados de pagamento são criptografados e gerenciados pelo Mercado Pago. A especialista atribuída recebe apenas o nome do cliente e, por segurança, o endereço completo é liberado somente 24 horas antes do atendimento agendado. O Método Pame não vende, aluga ou compartilha seus dados pessoais com terceiros para fins de marketing.</p>
              </div>

              <div>
                <p className="font-bold text-[#561668] uppercase tracking-wider text-[10px] md:text-xs">5. Seus Direitos (LGPD)</p>
                <p className="mt-1">Como titular de dados sob a legislação brasileira, você possui direito a: confirmação de tratamento, acesso aos dados coletados, correção de dados incompletos ou errados, e eliminação de dados pessoais desnecessários. Para exercer qualquer um desses direitos, entre em contato via e-mail.</p>
              </div>
            </div>
            <div className="p-4 border-t border-[#efe5ee] flex justify-end bg-[#faf1fa]/50">
              <button onClick={() => setShowPrivacyModal(false)} className="px-6 py-2.5 bg-[#561668] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm">
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Terms of Use Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-[#1e1a20]/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in animate-duration-200">
          <div className="silk-lift rounded-3xl w-full max-w-2xl bg-white overflow-hidden max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-[#efe5ee] flex justify-between items-center bg-[#561668] text-white">
              <h3 className="font-display italic text-xl font-semibold">Termos de Uso</h3>
              <button onClick={() => setShowTermsModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-xs md:text-sm text-[#4e434e] leading-relaxed space-y-4 font-sans select-text custom-scroll">
              <p className="font-bold text-[#561668] text-sm md:text-base font-display">TERMOS E CONDIÇÕES DE USO — MÉTODO PAME</p>
              <p>Bem-vinda ao <strong>Método Pame</strong>. Ao utilizar nosso site, preencher a Avaliação da Residência ou contratar nossos serviços, você concorda integralmente com os termos descritos abaixo.</p>
              
              <div>
                <p className="font-bold text-[#561668] uppercase tracking-wider text-[10px] md:text-xs">1. Objeto e Natureza dos Serviços</p>
                <p className="mt-1">O Método Pame atua na curadoria e limpeza residencial de alto padrão ("Home Detail") em Tijucas, SC. Todos os serviços são prestados por profissionais especialistas qualificadas, treinadas e verificadas sob os rigorosos critérios operacionais da nossa marca.</p>
              </div>

              <div>
                <p className="font-bold text-[#561668] uppercase tracking-wider text-[10px] md:text-xs">2. Condições de Reserva e Pagamento</p>
                <p className="mt-1">Os serviços (Avulsos ou Pacotes Mensais) são agendados e bloqueados no calendário somente após o preenchimento da Avaliação da Residência e confirmação integral do pagamento correspondente via Mercado Pago. Não são aceitos pagamentos diretos em espécie ou via Pix às funcionárias no local.</p>
              </div>

              <div>
                <p className="font-bold text-[#561668] uppercase tracking-wider text-[10px] md:text-xs">3. Política de Reagendamento e Cancelamento</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Reagendamento Livre:</strong> Pode ser solicitado sem custos com até 24 horas de antecedência em relação ao horário de início programado.</li>
                  <li><strong>Cancelamentos Tarde/Ausência:</strong> Cancelamentos feitos com menos de 24 horas de antecedência ou impossibilidade de entrada da especialista no imóvel na data combinada (por ausência do cliente ou falta de chaves) acarretarão a cobrança integral da sessão. Isso garante a compensação da especialista pelo tempo reservado e deslocamento.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-[#561668] uppercase tracking-wider text-[10px] md:text-xs">4. Obrigações do Contratante</p>
                <p className="mt-1">O cliente compromete-se a prover acesso livre e seguro para a especialista nas datas agendadas, indicar superfícies ou objetos que necessitem de instruções especiais, e manter um ambiente de trabalho profissional e respeitoso para com as parceiras.</p>
              </div>

              <div>
                <p className="font-bold text-[#561668] uppercase tracking-wider text-[10px] md:text-xs">5. Reclamações e Conciliação</p>
                <p className="mt-1">Quaisquer desconformidades no serviço prestado devem ser registradas com fotos e enviadas ao suporte oficial em até 24 horas da conclusão do serviço para análise e eventual correção gratuita. Contato de suporte: <a href="mailto:metodopame.homedetail@gmail.com" className="text-[#561668] underline font-bold">metodopame.homedetail@gmail.com</a>.</p>
              </div>
            </div>
            <div className="p-4 border-t border-[#efe5ee] flex justify-end bg-[#faf1fa]/50">
              <button onClick={() => setShowTermsModal(false)} className="px-6 py-2.5 bg-[#561668] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm">
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
