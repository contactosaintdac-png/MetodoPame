/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect } from 'react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ApplicationScreen } from '../types';
import { trackEvent } from '../lib/tracking';

interface WaitlistFormProps {
  onScreenChange: (screen: ApplicationScreen) => void;
}

export default function WaitlistForm({ onScreenChange }: WaitlistFormProps) {
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [source, setSource] = useState('');
  
  const [referrerUid, setReferrerUid] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Trigger floating glassmorphic toast
  const triggerToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load referrer if present in localStorage
  useEffect(() => {
    const refUid = localStorage.getItem('pame_referrer_uid');
    if (refUid) {
      setReferrerUid(refUid);
      // Fetch referrer name from Firestore
      getDoc(doc(db, 'users', refUid))
        .then(docSnap => {
          if (docSnap.exists()) {
            setReferrerName(docSnap.data().name || 'Uma cliente');
          }
        })
        .catch(err => console.error('Erro ao buscar indicador:', err));
    }
  }, []);

  // Format WhatsApp input: (XX) XXXXX-XXXX
  const handleWhatsappChange = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    let formatted = '';
    
    if (numbers.length > 0) {
      formatted = '(' + numbers.substring(0, 2);
      if (numbers.length > 2) {
        formatted += ') ' + numbers.substring(2, 7);
      }
      if (numbers.length > 7) {
        formatted += '-' + numbers.substring(7, 11);
      }
    }
    setWhatsapp(formatted);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'waitlist'), {
        name: fullName,
        whatsapp,
        email,
        neighborhood,
        serviceType,
        source,
        referredByUid: referrerUid,
        referredByName: referrerName,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setIsSubmitted(true);
      // Meta Pixel & GA4 Lead tracking
      trackEvent('Lead', {
        content_name: 'Lista de Espera',
        serviceType,
        neighborhood
      });
    } catch (error) {
      console.error('Erro ao salvar na lista de espera:', error);
      alert('Ocorreu um erro ao enviar seu cadastro. Tente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareClick = () => {
    const text = `Estou na lista de espera do agendamento online do Método Pame. Corre para se cadastrar também: https://metodopame.com`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-[#fff7fd]" style={{ fontFamily: 'Manrope, sans-serif' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white rounded-[2rem] border border-[#efe5ee] silk-card p-8 md:p-12 flex flex-col items-center text-center gap-6"
        >
          <div className="w-20 h-20 bg-[#faf1fa] border border-[#efe5ee] rounded-full flex items-center justify-center text-[#561668] shadow-sm">
            <span className="material-symbols-outlined text-4xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          </div>

          <div>
            <h2 className="text-3xl font-extrabold text-[#561668] tracking-tight">Cadastro Confirmado!</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-[#80737f] mt-1.5">Método Pame · Lista de Espera</p>
          </div>

          <div className="bg-[#faf1fa] p-6 rounded-2xl border border-[#efe5ee] w-full text-left flex flex-col gap-4 shadow-inner">
            <p className="text-sm font-bold text-[#561668]">O que acontece agora?</p>
            <p className="text-[14px] text-[#4e434e] leading-relaxed">
              Você está na lista prioritária. Enviaremos o link de agendamento por WhatsApp e e-mail assim que as novas vagas de atendimento forem liberadas.
            </p>
            {referrerName && (
              <div className="mt-1 p-3.5 bg-white rounded-xl border border-[#efe5ee] flex gap-2.5 items-center">
                <span className="material-symbols-outlined text-amber-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                <p className="text-xs text-[#561668] font-bold">Indicação de {referrerName} registrada com prioridade.</p>
              </div>
            )}
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={handleShareClick}
              className="w-full h-14 bg-[#561668] hover:bg-[#703081] !text-white text-xs font-extrabold uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md hover:shadow-lg duration-300"
            >
              <span className="material-symbols-outlined text-lg">share</span>
              Indicar uma Amiga
            </button>
            
            <button
              onClick={() => onScreenChange('welcome')}
              className="w-full h-14 border border-[#561668]/30 text-[#561668] text-xs font-extrabold uppercase tracking-widest rounded-xl hover:bg-[#faf1fa] transition-all active:scale-95 cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff7fd] relative w-full overflow-x-hidden text-[#1e1a20] antialiased" style={{ fontFamily: 'Manrope, sans-serif' }}>
      
      {/* Floating glassmorphic toast notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#561668]/95 backdrop-blur-md text-white text-xs font-bold px-5 py-3 rounded-full shadow-lg flex items-center gap-2 border border-white/20 animate-bounce">
          <span className="material-symbols-outlined text-sm">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── DESKTOP LAYOUT (PC) ── */}
      <div className="hidden md:block w-full">
        {/* Desktop Header */}
        <header className="fixed top-0 left-0 w-full z-50 bg-[#fff7fd]/60 backdrop-blur-xl border-b border-white/20">
          <div className="max-w-[1280px] mx-auto px-6 h-20 flex justify-between items-center">
            <div className="flex items-center">
              <img
                alt="Método Pame"
                className="h-12 w-auto object-contain cursor-pointer"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIA_N5gBskAWImYfX1Lu-eaQYlyjrqmU_nUqevCNxBi5yEV_ktx2emcvYqRiOu1u0DLlWJYSgsKo9XYCVzU89FJkVzRxSWOgvMxAwtfZtgfrvDFcpd-gECZBKrlQHXqrgT4EygocjuLYzi9v527uMXIO_6oHEjFeyhX9WD277WScjGHctILD2vAGD_gIr0kZ-HoTskVCSY5y1mc4mARmvG8elHa4t14C0ZZgu1xc4Uyd5yNdtECAeYLtvEEw1mH47rDFskr2Gnl_Vk"
                onClick={() => onScreenChange('welcome')}
              />
            </div>
            <nav className="flex items-center gap-10">
              <button
                onClick={() => onScreenChange('welcome')}
                className="text-xs uppercase tracking-[0.25em] font-extrabold text-[#4e434e] hover:text-[#561668] transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <a className="text-xs uppercase tracking-[0.25em] font-extrabold text-[#4e434e] hover:text-[#561668] transition-colors" href="#exp">
                A Experiência
              </a>
              <button
                onClick={() => {
                  const el = document.getElementById('pc-form-box');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-[#561668] text-white px-8 py-3 rounded-full text-xs font-extrabold uppercase tracking-widest hover:shadow-xl hover:shadow-[#561668]/20 transition-all active:scale-95 cursor-pointer"
              >
                Acesso Prioritário
              </button>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center pt-20 overflow-hidden">
          {/* Full Bleed Background */}
          <div className="absolute inset-0 z-0">
            <img
              alt="Luxury Interior"
              className="w-full h-full object-cover"
              src="/waitlist_luxury.png"
            />
            <div className="absolute inset-0 hero-overlay"></div>
          </div>
          
          <div className="max-w-[1280px] mx-auto px-6 relative z-10 w-full grid grid-cols-2 gap-16 items-center">
            {/* Left Column Content */}
            <div className="space-y-10 text-left">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-[#561668]">
                  <span className="w-12 h-[1px] bg-[#561668]"></span>
                  <span className="text-xs font-extrabold uppercase tracking-[0.3em]">Residências de Elite</span>
                </div>
                <h1 className="font-display italic text-6xl md:text-7xl leading-tight luxury-gradient-text" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
                  Lista de Espera <br />
                  <span className="not-italic font-extrabold tracking-tight">Exclusiva</span>
                </h1>
                <p className="text-sm text-[#4e434e] max-w-md leading-relaxed">
                  A excelência residencial do Método Pame agora em um formato digital de concierge. Garanta seu lugar no topo da nossa lista de atendimento prioritário.
                </p>
              </div>
              
              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#fcd7ff] flex items-center justify-center text-[#561668] shrink-0 shadow-lg shadow-[#561668]/10">
                    <span className="material-symbols-outlined">verified_user</span>
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-lg text-[#1e1a20]">Curadoria Técnica</h3>
                    <p className="text-[#4e434e]/70 text-xs mt-0.5">Protocolos desenhados para a preservação de materiais nobres.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#fcd7ff] flex items-center justify-center text-[#561668] shrink-0 shadow-lg shadow-[#561668]/10">
                    <span className="material-symbols-outlined">schedule</span>
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-lg text-[#1e1a20]">Gestão Inteligente</h3>
                    <p className="text-[#4e434e]/70 text-xs mt-0.5">Reserva de slots e histórico de atendimento em um só clique.</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Column Form Card */}
            <div className="flex justify-end" id="pc-form-box">
              <div className="silk-card w-full max-w-lg p-8 md:p-10 rounded-[2rem] text-left">
                {referrerName && (
                  <div className="mb-6 p-4 bg-[#faf1fa]/80 border border-[#efe5ee] rounded-2xl flex items-center gap-3">
                    <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                    <div>
                      <p className="text-xs font-bold text-[#561668]">Convidada por {referrerName}</p>
                      <p className="text-[10px] text-[#80737f] font-semibold">Seu cadastro receberá prioridade de agendamento.</p>
                    </div>
                  </div>
                )}
                
                <div className="mb-6 text-left">
                  <h2 className="text-2xl font-extrabold text-[#561668] mb-1.5">Solicitar Admissão</h2>
                  <p className="text-[#4e434e] text-xs font-medium">Preencha os campos abaixo para iniciar seu processo de admissão na agenda exclusiva.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Nome Completo */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#4e434e]/60 ml-2" htmlFor="pc-name">Nome Completo</label>
                    <input
                      id="pc-name"
                      required
                      className="w-full silk-input border-none rounded-xl px-5 py-3 outline-none focus:ring-0 text-sm text-[#1e1a20] placeholder:text-[#4e434e]/30"
                      placeholder="Ex: Arthur Montgomery"
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                    />
                  </div>
                  
                  {/* WhatsApp & Email (Side by Side) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#4e434e]/60 ml-2" htmlFor="pc-whatsapp">WhatsApp</label>
                      <input
                        id="pc-whatsapp"
                        required
                        className="w-full silk-input border-none rounded-xl px-5 py-3 outline-none focus:ring-0 text-sm text-[#1e1a20] placeholder:text-[#4e434e]/30"
                        placeholder="(48) 99999-0000"
                        type="tel"
                        value={whatsapp}
                        onChange={e => handleWhatsappChange(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#4e434e]/60 ml-2" htmlFor="pc-email">E-mail</label>
                      <input
                        id="pc-email"
                        required
                        className="w-full silk-input border-none rounded-xl px-5 py-3 outline-none focus:ring-0 text-sm text-[#1e1a20] placeholder:text-[#4e434e]/30"
                        placeholder="contato@luxo.com"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {/* Bairro (Dropdown) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#4e434e]/60 ml-2" htmlFor="pc-neighborhood">Bairro de Residência</label>
                    <div className="relative">
                      <select
                        id="pc-neighborhood"
                        required
                        className="w-full silk-input border-none rounded-xl px-5 py-3 outline-none focus:ring-0 text-sm text-[#1e1a20] appearance-none bg-transparent"
                        value={neighborhood}
                        onChange={e => setNeighborhood(e.target.value)}
                      >
                        <option value="" disabled>Selecione seu bairro (Tijucas e região)</option>
                        <option value="Centro">Centro</option>
                        <option value="Praça">Praça</option>
                        <option value="XV de Novembro">XV de Novembro</option>
                        <option value="Areias">Areias</option>
                        <option value="Universitário">Universitário</option>
                        <option value="Sul do Rio">Sul do Rio</option>
                        <option value="Outro (Tijucas / Região)">Outro (Tijucas / Região)</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#561668]/40 text-lg">keyboard_arrow_down</span>
                    </div>
                  </div>
                  
                  {/* Serviço (Dropdown) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#4e434e]/60 ml-2" htmlFor="pc-servico">Serviço Desejado</label>
                    <div className="relative">
                      <select
                        id="pc-servico"
                        required
                        className="w-full silk-input border-none rounded-xl px-5 py-3 outline-none focus:ring-0 text-sm text-[#1e1a20] appearance-none bg-transparent"
                        value={serviceType}
                        onChange={e => setServiceType(e.target.value)}
                      >
                        <option value="" disabled>Selecione a categoria de serviço</option>
                        <option value="Pacote Mensal (4x no mês)">Pacote Mensal (4x no mês) - Recomendado</option>
                        <option value="Serviço Avulso (Limpeza Única)">Serviço Avulso (Limpeza Única)</option>
                        <option value="Limpeza Pós-Obra">Limpeza Pós-Obra</option>
                        <option value="Outro">Outro</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#561668]/40 text-lg">keyboard_arrow_down</span>
                    </div>
                  </div>
                  
                  {/* Como nos conheceu (Dropdown) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#4e434e]/60 ml-2" htmlFor="pc-source">Como nos conheceu?</label>
                    <div className="relative">
                      <select
                        id="pc-source"
                        required
                        className="w-full silk-input border-none rounded-xl px-5 py-3 outline-none focus:ring-0 text-sm text-[#1e1a20] appearance-none bg-transparent"
                        value={source}
                        onChange={e => setSource(e.target.value)}
                      >
                        <option value="" disabled>Selecione uma opção</option>
                        <option value="Instagram">Instagram</option>
                        <option value="Indicação de Amigo">Indicação de amigo/cliente</option>
                        <option value="Já era cliente da Pame">Já era cliente da Pame</option>
                        <option value="Outro">Outro</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#561668]/40 text-lg">keyboard_arrow_down</span>
                    </div>
                  </div>
                  
                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#561668] hover:bg-[#703081] text-white py-4.5 rounded-xl text-xs font-extrabold uppercase tracking-[0.2em] shadow-2xl shadow-[#561668]/30 hover:opacity-95 transition-all flex justify-center items-center gap-3 group mt-6 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                    ) : (
                      <>
                        Enviar Solicitação
                        <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">trending_flat</span>
                      </>
                    )}
                  </button>
                </form>
                
                <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-center gap-2 text-[#4e434e]/40">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.1em]">Protocolo de Admissão Seguro</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Proof of Quality Section */}
        <section id="exp" className="bg-[#fff7fd] py-24 border-t border-[#efe5ee]">
          <div className="max-w-[1280px] mx-auto px-6">
            <div className="text-center mb-16 space-y-4">
              <h2 className="font-display italic text-4xl md:text-5xl text-[#561668]" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
                A Experiência Pame
              </h2>
              <p className="text-[#4e434e]/60 text-sm max-w-2xl mx-auto">
                Elevando o conceito de manutenção residencial a um padrão de hospitalidade cinco estrelas.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="group relative overflow-hidden rounded-2xl h-80 silk-card flex flex-col justify-end p-8 border-none shadow-xl">
                <img
                  alt="Living Room"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[30%] opacity-40"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7d2gtjLoWqqRKWQ9kEIjQz5AQTMg73guZimGFhPXZzNMVwr8HdBIK5JDLe9sjCfv8Ex8TreXMn1VeJArDMyaJvmg2KDCk_QeiAu_PQuEKI6I9EZEpq3tmvesjEitcgRG8HdBlL-G6yKyaepUMgujbxQ_hGCc2ofLYMZVv5jPCgTU5pcwoeTZB6kQQr4glD2v5R0miIZ75eqOBlACKp4-nK8RGpyssk5d0MdMynXeMild01tlQQZB-ZzBx3b2aN9V3sVjccKvNuMtl"
                />
                <div className="relative z-10 text-left">
                  <h4 className="font-sans font-bold text-[#561668] text-lg mb-2">Ordem Absoluta</h4>
                  <p className="text-xs text-[#4e434e] leading-relaxed font-medium">Sistemas de organização invisíveis que mantêm a serenidade do lar.</p>
                </div>
              </div>
              
              {/* Feature 2 */}
              <div className="group relative overflow-hidden rounded-2xl h-80 bg-[#561668] flex flex-col justify-center items-center p-8 text-center text-white shadow-2xl">
                <span className="material-symbols-outlined text-6xl mb-6 opacity-30" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                <h4 className="font-sans font-extrabold text-2xl mb-4">Padrão 5 Estrelas</h4>
                <p className="text-xs text-white/70 leading-relaxed max-w-[240px]">Cada visita é regida por um checklist de 120 pontos de inspeção de qualidade superior.</p>
                <div className="mt-8 px-6 py-2 border border-white/20 rounded-full text-[9px] font-extrabold uppercase tracking-widest">Exclusivo</div>
              </div>
              
              {/* Feature 3 */}
              <div className="group relative overflow-hidden rounded-2xl h-80 silk-card flex flex-col justify-end p-8 border-none shadow-xl">
                <img
                  alt="Silk Linens"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[30%] opacity-40"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC3Rc5uVIp3uSIh_fHQN5-DDy1nRyqlvKzKtPH5ejCIUj6Zawde5l1XGinrO5FFAFst658DNCyz_iPqLKd6AbZ0nnGmD_3Hikon9Q_7I6I8ZuZSniMWaqXGdL0mSYRIJb_k_Ef2cdtjxi8wl7mw23p8fTGOY-sSGC7puSbQ9sYy1cXtqJ3BrvpS4JKlcoCIjTzEoLyn8B6EC_MDpYTdlLmt-zr-ggtmssbV1i6OfSAYBy0p-0HZiLCWz7QdTZg_98nj98wiVGA1hO6J"
                />
                <div className="relative z-10 text-left">
                  <h4 className="font-sans font-bold text-[#561668] text-lg mb-2">Cuidado Tátil</h4>
                  <p className="text-xs text-[#4e434e] leading-relaxed font-medium">Produtos de PH neutro e técnicas de toque suave para superfícies de luxo.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Desktop Footer */}
        <footer className="bg-[#faf1fa] pt-20 pb-12 border-t border-[#efe5ee]">
          <div className="max-w-[1280px] mx-auto px-6 font-sans">
            <div className="flex justify-between items-start gap-12 mb-16 text-left">
              <div className="space-y-4">
                <img
                  alt="Método Pame"
                  className="h-10 w-auto opacity-80"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIA_N5gBskAWImYfX1Lu-eaQYlyjrqmU_nUqevCNxBi5yEV_ktx2emcvYqRiOu1u0DLlWJYSgsKo9XYCVzU89FJkVzRxSWOgvMxAwtfZtgfrvDFcpd-gECZBKrlQHXqrgT4EygocjuLYzi9v527uMXIO_6oHEjFeyhX9WD277WScjGHctILD2vAGD_gIr0kZ-HoTskVCSY5y1mc4mARmvG8elHa4t14C0ZZgu1xc4Uyd5yNdtECAeYLtvEEw1mH47rDFskr2Gnl_Vk"
                />
                <p className="text-[#4e434e]/60 text-[9px] font-extrabold uppercase tracking-widest max-w-[260px] leading-relaxed">
                  Residências que respiram excelência e serenidade através do método exclusivo.
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-24">
                <div className="space-y-4">
                  <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-[#561668]">Navegação</h5>
                  <ul className="space-y-2">
                    <li>
                      <button onClick={() => onScreenChange('welcome')} className="text-xs text-[#4e434e]/70 hover:text-[#561668] transition-colors cursor-pointer font-bold">
                        Início
                      </button>
                    </li>
                    <li>
                      <button onClick={() => onScreenChange('welcome')} className="text-xs text-[#4e434e]/70 hover:text-[#561668] transition-colors cursor-pointer font-bold">
                        O Método
                      </button>
                    </li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-[#561668]">Legal</h5>
                  <ul className="space-y-2">
                    <li><button onClick={() => window.dispatchEvent(new CustomEvent('open-privacy-modal'))} className="text-xs text-[#4e434e]/70 hover:text-[#561668] transition-colors font-bold cursor-pointer">Privacidade</button></li>
                    <li><button onClick={() => window.dispatchEvent(new CustomEvent('open-terms-modal'))} className="text-xs text-[#4e434e]/70 hover:text-[#561668] transition-colors font-bold cursor-pointer">Termos</button></li>
                  </ul>
                </div>
                
                <div className="space-y-4 text-left">
                  <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-[#561668]">Contato</h5>
                  <ul className="space-y-2 font-bold text-xs text-[#4e434e]/70">
                    <li>Tijucas e Região, SC</li>
                    <li>concierge@metodopame.com.br</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-8 border-t border-[#efe5ee]/50 gap-4">
              <p className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#4e434e]/40">
                © 2026 MÉTODO PAME. SILENT LUXURY BY DESIGN.
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* ── MOBILE LAYOUT (CELULAR) ── */}
      <div className="block md:hidden w-full pb-20">
        {/* Mobile Header */}
        <header className="sticky top-0 z-50 bg-[#fff7fd]/80 backdrop-blur-md px-4 h-16 flex justify-between items-center shadow-[4px_4px_10px_#E2D9E6,-4px_-4px_10px_#FFFFFF]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onScreenChange('welcome')}
              className="material-symbols-outlined text-[#561668] text-2xl cursor-pointer"
            >
              arrow_back
            </button>
          </div>
          <div className="font-sans font-black text-lg text-[#561668] tracking-tight">Método Pame</div>
          <div className="w-8"></div>
        </header>

        {/* Hero Section - Text on solid background for perfect legibility */}
        <div className="pt-8 pb-4 px-6 text-center">
          <p className="text-[10px] font-extrabold text-[#561668] uppercase tracking-[0.25em] mb-2">Lista de Espera</p>
          <h1 className="font-display text-3.5xl text-[#561668] leading-tight italic font-bold mb-3" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
            Lista de Espera Exclusiva
          </h1>
          <p className="text-xs text-[#4e434e] max-w-[280px] mx-auto leading-relaxed font-semibold">
            Acesso prioritário ao ecossistema de gestão e bem-estar mais exclusivo do Brasil.
          </p>
        </div>

        {/* Beautiful framed luxury image */}
        <div className="px-5 pb-6">
          <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-[#efe5ee] shadow-[0_4px_12px_rgba(112,48,129,0.05)]">
            <img
              alt="Luxury Residence"
              className="w-full h-full object-cover"
              src="/waitlist_luxury.png"
            />
          </div>
        </div>

        {/* Form Section */}
        <section className="px-5 pb-12">
          <div className="bg-white border border-[#efe5ee] rounded-3xl p-6 space-y-6 text-left shadow-[0_8px_24px_rgba(112,48,129,0.03)]">
            <div className="space-y-1 text-center mb-4">
              <p className="text-xs font-extrabold text-[#561668] uppercase tracking-widest">Inscrição VIP</p>
              <div className="h-[1px] w-12 bg-[#561668]/20 mx-auto mt-2"></div>
            </div>
            
            {referrerName && (
              <div className="mb-4 p-3.5 bg-[#faf1fa] border border-[#efe5ee] rounded-2xl flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                <div>
                  <p className="text-[11px] font-bold text-[#561668]">Convidada por {referrerName}</p>
                  <p className="text-[9px] text-[#80737f] font-semibold">Prioridade registrada de agendamento.</p>
                </div>
              </div>
            )}
            
            {/* Input Groups */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[#561668] ml-2">Nome Completo</label>
                <input
                  required
                  className="w-full h-12 rounded-xl px-4 border border-[#efe5ee] bg-white text-[#1e1a20] placeholder:text-[#80737f]/50 text-sm font-sans focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  placeholder="Ex: Maria Luísa Fontes"
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[#561668] ml-2">WhatsApp</label>
                <input
                  required
                  className="w-full h-12 rounded-xl px-4 border border-[#efe5ee] bg-white text-[#1e1a20] placeholder:text-[#80737f]/50 text-sm font-sans focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  placeholder="(48) 99999-9999"
                  type="tel"
                  value={whatsapp}
                  onChange={e => handleWhatsappChange(e.target.value)}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[#561668] ml-2">E-mail</label>
                <input
                  required
                  className="w-full h-12 rounded-xl px-4 border border-[#efe5ee] bg-white text-[#1e1a20] placeholder:text-[#80737f]/50 text-sm font-sans focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  placeholder="contato@exemplo.com"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              
              {/* Bairro (Dropdown) */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[#561668] ml-2">Bairro de Residência</label>
                <div className="relative">
                  <select
                    required
                    className="w-full h-12 rounded-xl px-4 border border-[#efe5ee] bg-white text-[#1e1a20] text-sm font-sans appearance-none focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all cursor-pointer"
                    value={neighborhood}
                    onChange={e => setNeighborhood(e.target.value)}
                  >
                    <option value="" disabled>Selecione seu bairro</option>
                    <option value="Centro">Centro</option>
                    <option value="Praça">Praça</option>
                    <option value="XV de Novembro">XV de Novembro</option>
                    <option value="Areias">Areias</option>
                    <option value="Universitário">Universitário</option>
                    <option value="Sul do Rio">Sul do Rio</option>
                    <option value="Outro (Tijucas / Região)">Outro (Tijucas / Região)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-3 text-[#561668]/50 pointer-events-none">expand_more</span>
                </div>
              </div>
              
              {/* Serviço (Dropdown) */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[#561668] ml-2">Serviço Desejado</label>
                <div className="relative">
                  <select
                    required
                    className="w-full h-12 rounded-xl px-4 border border-[#efe5ee] bg-white text-[#1e1a20] text-sm font-sans appearance-none focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all cursor-pointer"
                    value={serviceType}
                    onChange={e => setServiceType(e.target.value)}
                  >
                    <option value="" disabled>Selecione o serviço</option>
                    <option value="Pacote Mensal (4x no mês)">Pacote Mensal (4x no mês)</option>
                    <option value="Serviço Avulso (Limpeza Única)">Serviço Avulso (Limpeza Única)</option>
                    <option value="Limpeza Pós-Obra">Limpeza Pós-Obra</option>
                    <option value="Outro">Outro</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-3 text-[#561668]/50 pointer-events-none">expand_more</span>
                </div>
              </div>
              
              {/* Como nos conheceu (Dropdown) */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[#561668] ml-2">Como nos conheceu?</label>
                <div className="relative">
                  <select
                    required
                    className="w-full h-12 rounded-xl px-4 border border-[#efe5ee] bg-white text-[#1e1a20] text-sm font-sans appearance-none focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all cursor-pointer"
                    value={source}
                    onChange={e => setSource(e.target.value)}
                  >
                    <option value="" disabled>Selecione uma opção</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Indicação de Amigo">Indicação de amigo/cliente</option>
                    <option value="Já era cliente da Pame">Já era cliente da Pame</option>
                    <option value="Outro">Outro</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-3 text-[#561668]/50 pointer-events-none">expand_more</span>
                </div>
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 bg-[#561668] hover:bg-[#703081] text-white font-extrabold rounded-xl shadow-md active:scale-[0.97] hover:shadow-lg transition-all mt-6 text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                ) : (
                  <>
                    Solicitar Acesso
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                  </>
                )}
              </button>
            </form>
            
            <p className="text-center text-[10px] text-[#80737f] px-4 italic leading-relaxed">
              *Sujeito a análise de perfil e disponibilidade de agenda.
            </p>
          </div>
        </section>

        {/* Trust Section (Luxury Pillars) */}
        <section className="px-5 py-12 space-y-8 bg-[#faf1fa]/50 border-t border-[#efe5ee]">
          <h2 className="font-display text-3xl text-[#561668] text-center italic" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
            Pilares do Método
          </h2>
          
          <div className="flex flex-col gap-5 text-left">
            {/* Pillar 1 */}
            <div className="silk-lift rounded-2xl p-5 flex gap-4 items-start">
              <div className="w-11 h-11 rounded-xl bg-[#fcd7ff] flex items-center justify-center flex-shrink-0 text-[#561668]">
                <span className="material-symbols-outlined">verified_user</span>
              </div>
              <div>
                <h3 className="font-sans font-bold text-[#561668] text-md">Atendimento Personalizado</h3>
                <p className="text-xs text-[#4e434e] mt-1 leading-relaxed">Cada detalhe planejado exclusivamente para sua rotina e necessidades únicas.</p>
              </div>
            </div>
            
            {/* Pillar 2 */}
            <div className="silk-lift rounded-2xl p-5 flex gap-4 items-start">
              <div className="w-11 h-11 rounded-xl bg-[#fcd7ff] flex items-center justify-center flex-shrink-0 text-[#561668]">
                <span className="material-symbols-outlined">auto_awesome</span>
              </div>
              <div>
                <h3 className="font-sans font-bold text-[#561668] text-md">Gestão Inteligente</h3>
                <p className="text-xs text-[#4e434e] mt-1 leading-relaxed">Tecnologia e curadoria humana em perfeita harmonia para seu tempo.</p>
              </div>
            </div>
            
            {/* Pillar 3 */}
            <div className="silk-lift rounded-2xl p-5 flex gap-4 items-start">
              <div className="w-11 h-11 rounded-xl bg-[#fcd7ff] flex items-center justify-center flex-shrink-0 text-[#561668]">
                <span className="material-symbols-outlined">diamond</span>
              </div>
              <div>
                <h3 className="font-sans font-bold text-[#561668] text-md">Exclusividade Real</h3>
                <p className="text-xs text-[#4e434e] mt-1 leading-relaxed">Acesso a serviços e profissionais homologados com o selo de qualidade Pame.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Narrative Section on Mobile */}
        <section className="py-16 px-5 border-t border-[#efe5ee]">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl text-[#561668] italic mb-3" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
              A Experiência Pame
            </h2>
            <div className="h-[1px] w-20 bg-[#561668]/20 mx-auto"></div>
          </div>
          
          <div className="space-y-12 text-left">
            {/* Moment 1 */}
            <div>
              <div className="relative w-full aspect-[4/5] rounded-[2rem] overflow-hidden mb-5 silk-lift">
                <img
                  alt="Luxury Spa"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAUzhaeopDPQ3nCOpK1z82s9jpqUDm5_evAi6UxEdfj8JKk6AKjrTsmZJy1ABqcIduYplpYTw4WixRcnPoeCpGDSgnshm-RQmw3cyqRF1PxVQPl0JOO2jRYKOhVTTrQJPuxKuVeS3nCC-yshkPlyFIOC9nsUdVNkxSxbsmbg1lbTY-T3Txs6AjXTFP4fuxDtz6TvT0GvZPmI-n5Q4YSVZc1Qf32Vk5FLoaRu-OcukLiI0yQv_1pI-Zzxi7Eh5W7S8k7GEhtIwthxqIz"
                />
                <div className="absolute inset-0 bg-[#561668]/5"></div>
              </div>
              <div className="px-1">
                <span className="text-[10px] font-extrabold text-[#561668] uppercase tracking-widest">Momento 01</span>
                <h4 className="font-sans font-bold text-lg text-[#561668] my-1">Harmonia Residencial</h4>
                <p className="text-xs text-[#4e434e] leading-relaxed">Transformamos sua casa em um santuário de ordem e sofisticação.</p>
              </div>
            </div>
            
            {/* Moment 2 */}
            <div>
              <div className="relative w-full aspect-[4/5] rounded-[2rem] overflow-hidden mb-5 silk-lift">
                <img
                  alt="Concierge Service"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBMwUbsSIbBApn4GM0mKcPpShJwww2BQmKVxoHbwKd465H9F9KCAHavRE-goIsJA1SJS0RfVNDnmYBBVgVxLPt-RLezeQX_oxKVQmcIL1624pyEa-iuZ2l3rAsIckcGiTgttH9IHOiszYKlfVDgtS3fXoc111p1wINVsP1RzgLdUye6AW2kUfq52Bvlk_K8V79VyNTHi9rGv0DWyCuns-rZ8s0TWWB9w4YxL-PjReYQ8rPVFLnUmN4BDM5Tejp93QskdoJS8RaAq4Od"
                />
                <div className="absolute inset-0 bg-[#561668]/5"></div>
              </div>
              <div className="px-1">
                <span className="text-[10px] font-extrabold text-[#561668] uppercase tracking-widest">Momento 02</span>
                <h4 className="font-sans font-bold text-lg text-[#561668] my-1">Liberdade de Tempo</h4>
                <p className="text-xs text-[#4e434e] leading-relaxed">Delegue o complexo para quem domina a arte da organização.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Footer */}
        <footer className="bg-[#faf1fa]/80 pt-12 pb-32 px-6 border-t border-[#efe5ee] text-center font-sans">
          <div className="flex flex-col items-center gap-6">
            <div className="font-sans font-black text-xl text-[#561668] tracking-tight">Método Pame</div>
            <div className="flex gap-4">
              <a className="w-10 h-10 rounded-full silk-lift flex items-center justify-center text-[#561668]" href="#">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"></path>
                </svg>
              </a>
            </div>
            
            <div className="flex flex-col gap-2.5 text-xs font-bold text-[#80737f] uppercase tracking-widest">
              <button onClick={() => window.dispatchEvent(new CustomEvent('open-privacy-modal'))} className="hover:text-[#561668] transition-colors cursor-pointer font-bold text-center">Privacidade</button>
              <button onClick={() => window.dispatchEvent(new CustomEvent('open-terms-modal'))} className="hover:text-[#561668] transition-colors cursor-pointer font-bold text-center">Termos de Uso</button>
              <a href="#">FAQ VIP</a>
            </div>
            
            <div className="text-[10px] text-[#80737f]/60 mt-2">
              © 2026 Método Pame. Todos os direitos reservados.
            </div>
          </div>
        </footer>

        {/* Bottom Navigation Bar (Fixed for Mobile Shell) */}
        <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20 px-4 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-4px_10px_#E2D9E6] font-sans">
          <button
            onClick={() => triggerToast('Painel disponível apenas após admissão.')}
            className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 cursor-pointer"
          >
            <span className="material-symbols-outlined mb-1">dashboard</span>
            <span className="text-[10px] font-bold">Dashboard</span>
          </button>
          <button
            onClick={() => triggerToast('Agenda disponível apenas após admissão.')}
            className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 cursor-pointer"
          >
            <span className="material-symbols-outlined mb-1">calendar_today</span>
            <span className="text-[10px] font-bold">Agenda</span>
          </button>
          <button
            onClick={() => triggerToast('Portais disponíveis apenas para membros.')}
            className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-xl px-4 py-1 scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined mb-1">apps</span>
            <span className="text-[10px] font-bold">Portais</span>
          </button>
          <button
            onClick={() => triggerToast('Perfil disponível apenas após admissão.')}
            className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 cursor-pointer"
          >
            <span className="material-symbols-outlined mb-1">person</span>
            <span className="text-[10px] font-bold">Perfil</span>
          </button>
        </nav>
      </div>

    </div>
  );
}
