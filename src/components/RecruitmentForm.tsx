/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ApplicationScreen, Employee } from '../types';
import { useAuth } from '../contexts/AuthContext';
import EspecialistaDashboard from './EspecialistaDashboard';

interface RecruitmentFormProps {
  onScreenChange: (screen: ApplicationScreen) => void;
}

// ─────────────────────────────────────────────
//  VIEW STATES
// ─────────────────────────────────────────────
type EquipeView = 'loading' | 'login' | 'dashboard' | 'candidatura' | 'success';

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export default function RecruitmentForm({ onScreenChange }: RecruitmentFormProps) {
  const { user, loading: authLoading, signInWithEmail, signOut } = useAuth();

  const formatWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers.length > 0 ? `(${numbers}` : '';
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const [view, setView]                     = useState<EquipeView>('loading');
  const [employeeData, setEmployeeData]     = useState<Employee | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail]         = useState('');
  const [loginPassword, setLoginPassword]   = useState('');
  const [loginError, setLoginError]         = useState('');
  const [loginLoading, setLoginLoading]     = useState(false);

  // Candidatura form state
  const [fullName, setFullName]             = useState('');
  const [whatsapp, setWhatsapp]             = useState('');
  const [candidacyEmail, setCandidacyEmail]       = useState('');
  const [candidacyPassword, setCandidacyPassword] = useState('');
  const [experience, setExperience]         = useState('');
  const [skills, setSkills]                 = useState('');
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [isFocused, setIsFocused]           = useState<string | null>(null);

  // Client gating state
  const [isClientLoggedIn, setIsClientLoggedIn] = useState(false);

  // ─── On auth state — decide view ─────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setView('login');
      setIsClientLoggedIn(false);
      return;
    }

    // User is logged in — check if they are an active specialist
    // We do a direct point read by UID (allowed by isOwner rule) instead of a
    // collection query (which would be blocked by Firestore rules for non-admins).
    const checkSpecialist = async () => {
      try {
        // 1. Try a direct read: /employees/{user.uid}
        const empDocRef = doc(db, 'employees', user.uid);
        const empDoc = await getDoc(empDocRef);

        if (empDoc.exists() && empDoc.data()?.status === 'active') {
          setEmployeeData({ id: empDoc.id, ...empDoc.data() } as Employee);
          setView('dashboard');
          setIsClientLoggedIn(false);
          return;
        }

        // 2. Document doesn't exist or status is not 'active'.
        // Check if they signed in with Google (Google Auth means they are a client)
        const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');
        if (isGoogleUser) {
          setIsClientLoggedIn(true);
          setView('candidatura');
        } else {
          // They signed in with email/password but are not an active specialist.
          // Could be pending approval or the migration hasn't run yet.
          await signOut();
          setLoginError('Sua conta de especialista ainda não foi ativada ou foi suspensa pela coordenação. Entre em contato com a Pame.');
          setView('login');
          setIsClientLoggedIn(false);
        }
      } catch (err) {
        console.error('Error checking specialist status:', err);
        setView('login');
        setIsClientLoggedIn(false);
      }
    };

    checkSpecialist();
  }, [user, authLoading]);

  // ─── Login handler ────────────────────────────────────────────────────────────
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
      // useEffect will re-run and determine the view
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setLoginError('Email ou senha incorretos. Contacte a coordenação.');
      } else if (code === 'auth/too-many-requests') {
        setLoginError('Muitas tentativas. Aguarde alguns minutos.');
      } else {
        setLoginError('Erro ao entrar. Tente novamente.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // ─── Candidatura submit ───────────────────────────────────────────────────────
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const cleanPhone = whatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      alert('Por favor, insira um número de WhatsApp válido com DDD e 9 dígitos (ex: (48) 99999-9999).');
      setIsSubmitting(false);
      return;
    }

    const emailToRegister = candidacyEmail.trim().toLowerCase();
    if (candidacyPassword.length < 6) {
      alert('A senha deve ter no mínimo 6 caracteres.');
      setIsSubmitting(false);
      return;
    }

    let tempApp;
    let createdUid: string | null = null;
    let createdIdToken: string | null = null;
    try {
      // Create account in Firebase Auth using a secondary app instance
      const appName = `temp-reg-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, appName);
      const tempAuth = getAuth(tempApp);
      const userCredential = await createUserWithEmailAndPassword(tempAuth, emailToRegister, candidacyPassword);
      createdUid = userCredential.user.uid;
      createdIdToken = await userCredential.user.getIdToken();
    } catch (authError: any) {
      console.error('Error creating auth account:', authError);
      let errorMsg = 'Ocorreu um erro ao criar sua credencial de acesso. Tente novamente.';
      if (authError?.code === 'auth/email-already-in-use') {
        errorMsg = 'Este e-mail já está cadastrado. Por favor, utilize outro e-mail.';
      } else if (authError?.code === 'auth/invalid-email') {
        errorMsg = 'E-mail inválido. Por favor, verifique o formato do e-mail.';
      } else if (authError?.code === 'auth/weak-password') {
        errorMsg = 'A senha fornecida é muito fraca. Escolha uma senha mais forte.';
      }
      alert(errorMsg);
      setIsSubmitting(false);
      return;
    } finally {
      if (tempApp) {
        try {
          await deleteApp(tempApp);
        } catch (delErr) {
          console.error('Error deleting temp app:', delErr);
        }
      }
    }

    try {
      if (!createdUid || !createdIdToken) {
        throw new Error('UID de autenticação não encontrado.');
      }
      const response = await fetch('/api/people', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createdIdToken}` },
        body: JSON.stringify({ action: 'candidate.submit', name: fullName, whatsapp, experience, zones: skills }),
      });
      if (!response.ok) throw new Error('Não foi possível registrar a candidatura.');
      const result = await response.json() as { applicationId: string };
      void result;
      setView('success');
    } catch (error) {
      console.error('Erro ao registrar:', error);
      alert('Ocorreu um erro ao enviar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Loading spinner ──────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#fff7fd' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white border border-[#efe5ee] shadow-md overflow-hidden">
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

  // ─── Dashboard (active specialist) ───────────────────────────────────────────
  if (view === 'dashboard') {
    return <EspecialistaDashboard employee={employeeData} />;
  }

  // ─── Login / Entry screen ─────────────────────────────────────────────────────
  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: '#fff7fd', fontFamily: 'Manrope, sans-serif' }}>
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white border border-[#efe5ee] mb-5 shadow-lg overflow-hidden">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn" 
                alt="Logo Método Pame" 
                className="w-12 h-12 object-cover" 
              />
            </div>
            <h1 className="text-2xl font-extrabold text-[#561668]">Área da Especialista</h1>
            <p className="text-sm text-[#80737f] mt-1 font-medium">Método Pame · Uso Interno</p>
          </div>

          {/* Two entry paths */}
          <AnimatePresence mode="wait">
            <motion.div
              key="login-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl border border-[#efe5ee] shadow-[0_8px_32px_rgba(86,22,104,0.08)] p-8 flex flex-col gap-6"
            >
              {/* Login form */}
              <div>
                <h2 className="text-base font-extrabold text-[#1e1a20] mb-1">Já sou especialista</h2>
                <p className="text-xs text-[#80737f]">Use as credenciais fornecidas pela coordenação.</p>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#703081]" htmlFor="eq-email">
                    Email
                  </label>
                  <input
                    id="eq-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="w-full h-12 px-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl text-sm text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#703081]" htmlFor="eq-password">
                    Senha
                  </label>
                  <input
                    id="eq-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="w-full h-12 px-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl text-sm text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  />
                </div>

                {loginError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-red-500 text-[16px]">error</span>
                    <p className="text-xs text-red-600 font-semibold">{loginError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full h-12 rounded-xl text-white text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 hover:opacity-90 active:scale-95 disabled:opacity-50"
                  style={{ background: '#561668' }}
                >
                  {loginLoading ? (
                    <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">login</span>
                      Entrar
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#efe5ee]" />
                <span className="text-[10px] font-bold text-[#d1c2d0] uppercase tracking-widest">ou</span>
                <div className="flex-1 h-px bg-[#efe5ee]" />
              </div>

              {/* Candidatura path */}
              <div>
                <h2 className="text-base font-extrabold text-[#1e1a20] mb-1">Quero me candidatar</h2>
                <p className="text-xs text-[#80737f] mb-4">Preencha o formulário de avaliação e aguarde o contato da Pame.</p>
                <button
                  onClick={() => setView('candidatura')}
                  className="w-full h-12 rounded-xl border border-[#561668]/30 text-[#561668] text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#faf1fa] transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">assignment_ind</span>
                  Formulário de Candidatura
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          <p className="text-center text-[10px] text-[#d1c2d0] font-bold uppercase tracking-widest mt-6">
            © 2026 Método Pame · Uso Interno Restrito
          </p>
        </div>
      </div>
    );
  }

  // ─── Success screen ───────────────────────────────────────────────────────────
  if (view === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: '#fff7fd', fontFamily: 'Manrope, sans-serif' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl border border-[#efe5ee] shadow-[0_8px_32px_rgba(86,22,104,0.08)] p-8 flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 bg-[#efe5ee] rounded-full flex items-center justify-center text-[#561668] shadow-md flex-shrink-0">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          </div>
          <div className="text-center"><h2 className="text-2xl font-extrabold text-[#561668] tracking-tight">Avaliação Recebida!</h2><p className="text-[10px] font-bold uppercase tracking-widest text-[#80737f] mt-1">Método Pame · Recrutamento</p></div>
          <div className="bg-[#faf1fa] p-5 rounded-2xl border border-[#efe5ee] w-full flex gap-3"><span className="material-symbols-outlined text-[#703081] text-[18px] mt-0.5">coffee</span><div className="text-left"><p className="text-xs font-bold text-[#561668]">Próxima etapa: Café Virtual com a Pame</p><p className="text-[11px] text-[#4e434e] mt-0.5 leading-relaxed">A confirmação é realizada pela equipe durante a análise da candidatura.</p></div></div>
          <button onClick={() => setView('login')} className="w-full h-12 bg-[#561668] hover:bg-[#703081] text-white text-xs font-extrabold uppercase tracking-widest rounded-xl transition-colors cursor-pointer">Voltar à Tela de Entrada</button>
        </motion.div>
      </div>
    );
  }

  // ─── Candidatura form ─────────────────────────────────────────────────────────
  return (
    <div className="flex-1 w-full bg-[#fff7fd]" style={{ fontFamily: 'Manrope, sans-serif' }}>
      <main className="max-w-7xl mx-auto py-10 px-4 md:px-12 flex flex-col md:flex-row gap-10 items-start justify-center">

        {/* Left — Context */}
        <div className="w-full md:w-5/12 flex flex-col gap-6 md:sticky md:top-6">
          <div className="relative w-full h-72 rounded-2xl overflow-hidden bg-[#f4ebf4]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#561668]/10 to-transparent z-10" />
            <img
              alt="Especialistas PAME"
              className="w-full h-full object-cover grayscale opacity-90 transition-transform duration-[1500ms] hover:scale-105"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAucqlbhBj0BQPWcsER41eUZHYH6hPDNMzik5buj3UNffWMXUNmeah53g1iz3nZWVT-ulL7V7QeMxDpMfC_qBTSmvRCSlADDFJ51i6fnQO5-03CUatQ4NQsWJ0yps2SOfKmopKriT6tFfVppG0595louVR_h8GcwCmTz7COcXs4m-q53_UeNFua0i5cDkewea_TepvC-VDlBdzpLWfJITIp3dpUmp05YXNeGNIoEPzW-FrMLDtlpFOJxiI9Yd3aHANevsMBSYKT0Mmq"
            />
          </div>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setView('login')}
              className="self-start flex items-center gap-2 text-[#80737f] hover:text-[#561668] text-xs font-bold uppercase tracking-widest transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Voltar
            </button>
            <h1 className="font-sans text-3xl md:text-4xl font-extrabold text-[#561668] tracking-tight leading-tight">
              Especialistas PAME<br />
              <span className="text-[#80737f] text-xl font-normal">Alto Padrão</span>
            </h1>
            <div className="w-16 h-1.5 bg-[#703081] rounded-full" />
            <p className="text-[15px] text-[#4e434e] leading-relaxed">
              Buscamos profissionais definidos pela <strong className="text-[#561668] font-bold">Maturidade Operacional</strong>. O rigor técnico e a discrição absoluta são os pilares da nossa entrega em lares de altíssimo padrão.
            </p>
            <p className="text-xs text-[#80737f] leading-relaxed">
              Preencha o formulário ao lado para iniciar seu processo de avaliação confidencial. Todas as informações são protegidas e isoladas do escopo comercial.
            </p>
          </div>
        </div>

        {/* Right — Form */}
        <div className="w-full md:w-7/12 bg-white rounded-2xl border border-[#efe5ee] shadow-[0_4px_24px_rgba(86,22,104,0.07)] p-6 md:p-8">
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">

            {isClientLoggedIn && (
              <div className="bg-[#faf1fa] border border-[#efe5ee] rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 text-left w-full">
                <div className="flex gap-3 items-start">
                  <span className="material-symbols-outlined text-[#561668] mt-0.5">account_circle</span>
                  <div>
                    <p className="text-xs font-bold text-[#561668]">Conectado como Cliente</p>
                    <p className="text-[11px] text-[#80737f]">{user?.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    setIsClientLoggedIn(false);
                    setView('login');
                  }}
                  className="px-4 py-2 bg-white hover:bg-[#efe5ee] text-[#561668] border border-[#d1c2d0]/30 rounded-xl font-bold text-[10px] tracking-wider uppercase transition-all shadow-[2px_2px_5px_rgba(112,48,129,0.1)] active:scale-95 cursor-pointer flex-shrink-0"
                >
                  Sair da Conta
                </button>
              </div>
            )}

            {[
              { id: 'fullName', label: 'Nome Completo', type: 'text', placeholder: 'Seu nome completo', value: fullName, set: setFullName, required: true },
              { id: 'candidacyEmail', label: 'E-mail para Acesso', type: 'email', placeholder: 'seu@email.com', value: candidacyEmail, set: setCandidacyEmail, required: true },
              { id: 'candidacyPassword', label: 'Senha de Acesso', type: 'password', placeholder: 'Mínimo 6 caracteres', value: candidacyPassword, set: setCandidacyPassword, required: true },
              { id: 'whatsapp', label: 'WhatsApp', type: 'tel', placeholder: '(48) 99999-9999', value: whatsapp, set: setWhatsapp, required: true },
            ].map(f => (
              <div key={f.id} className="flex flex-col gap-1.5">
                <label
                  className={`text-[11px] font-extrabold tracking-widest uppercase ml-1 transition-colors ${isFocused === f.id ? 'text-[#561668]' : 'text-[#703081]'}`}
                  htmlFor={f.id}
                >
                  {f.label}
                </label>
                <input
                  id={f.id}
                  type={f.type}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={f.value}
                  onFocus={() => setIsFocused(f.id)}
                  onBlur={() => setIsFocused(null)}
                  onChange={e => {
                    let val = e.target.value;
                    if (f.id === 'whatsapp') {
                      val = formatWhatsApp(val);
                    }
                    f.set(val);
                  }}
                  className="w-full h-12 px-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl text-sm text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                />
              </div>
            ))}

            {/* Experiência */}
            <div className="flex flex-col gap-1.5">
              <label className={`text-[11px] font-extrabold tracking-widest uppercase ml-1 transition-colors ${isFocused === 'experience' ? 'text-[#561668]' : 'text-[#703081]'}`} htmlFor="experience">
                Tempo de Experiência (Mín. 3 anos)
              </label>
              <div className="relative">
                <select
                  id="experience"
                  required
                  value={experience}
                  onFocus={() => setIsFocused('experience')}
                  onBlur={() => setIsFocused(null)}
                  onChange={e => setExperience(e.target.value)}
                  className="w-full h-12 px-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl text-sm text-[#1e1a20] appearance-none focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                >
                  <option value="" disabled>Selecione o tempo de experiência</option>
                  <option value="3-5">3 a 5 anos</option>
                  <option value="5-10">5 a 10 anos</option>
                  <option value="10+">Mais de 10 anos</option>
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#703081] pointer-events-none text-2xl">expand_more</span>
              </div>
            </div>

            {/* Habilidades */}
            <div className="flex flex-col gap-1.5">
              <label className={`text-[11px] font-extrabold tracking-widest uppercase ml-1 transition-colors ${isFocused === 'skills' ? 'text-[#561668]' : 'text-[#703081]'}`} htmlFor="skills">
                Habilidades Específicas
              </label>
              <textarea
                id="skills"
                rows={2}
                placeholder="Ex: Limpeza de vidros, cuidados com mármore..."
                value={skills}
                onFocus={() => setIsFocused('skills')}
                onBlur={() => setIsFocused(null)}
                onChange={e => setSkills(e.target.value)}
                className="w-full p-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl text-sm text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all resize-none"
              />
            </div>

            {/* Submit */}
            <div className="mt-2 pt-6 border-t border-[#efe5ee]">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 bg-[#561668] hover:bg-[#703081] text-white text-xs font-extrabold uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 hover:shadow-lg active:scale-98 cursor-pointer"
              >
                {isSubmitting ? (
                  <><span className="material-symbols-outlined animate-spin text-[20px]">sync</span><span>Enviando...</span></>
                ) : (
                  <><span>Submeter Avaliação</span><span className="material-symbols-outlined text-[20px]">arrow_forward</span></>
                )}
              </button>
              <div className="flex items-center justify-center gap-2 mt-4 text-[#80737f]">
                <span className="material-symbols-outlined text-sm font-bold">lock</span>
                <p className="text-[10px] tracking-widest uppercase font-bold">Processo protegido por sigilo absoluto</p>
              </div>
            </div>

          </form>
        </div>
      </main>

      <footer className="w-full py-8 mt-10 text-center border-t border-[#efe5ee]">
        <p className="text-[10px] text-[#80737f] tracking-[0.3em] uppercase font-bold">
          © 2026 METODO PAME. USO INTERNO RESTRITO.
        </p>
      </footer>
    </div>
  );
}
