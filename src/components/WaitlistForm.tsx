/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect } from 'react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ApplicationScreen } from '../types';

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
  const [isFocused, setIsFocused] = useState<string | null>(null);

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
    } catch (error) {
      console.error('Erro ao salvar na lista de espera:', error);
      alert('Ocorreu um erro ao enviar seu cadastro. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareClick = () => {
    const text = `Estou na lista de espera do agendamento online do Método Pame. Corre para se cadastrar também: https://www.metodopame.com`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-[#fff7fd]" style={{ fontFamily: 'Manrope, sans-serif' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white rounded-3xl border border-[#efe5ee] shadow-[0_8px_32px_rgba(86,22,104,0.08)] p-8 md:p-10 flex flex-col items-center text-center gap-6"
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

          <div className="bg-[#faf1fa] p-6 rounded-2xl border border-[#efe5ee] w-full text-left flex flex-col gap-4">
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
              className="w-full h-14 bg-[#561668] hover:bg-[#703081] text-xs font-extrabold uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md"
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
    <div className="min-h-screen flex flex-col md:flex-row w-full bg-[#fff7fd]" style={{ fontFamily: 'Manrope, sans-serif' }}>
      
      {/* Left side banner */}
      <div className="w-full md:w-5/12 bg-[#561668] p-8 md:p-16 text-white flex flex-col justify-between relative overflow-hidden min-h-[350px] md:min-h-screen">
        <div className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        
        {/* Brand */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 p-1">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVcxmZMz9YKjAnrCGzskq9ne1p2Otcvat0qmcKlgJO1O9Pc7p6GZ9k9sB7x8Bfy-btyeFytukZNZyc4mH4DDLbmVbNtXPveuW1Prq5KisOb_95gOr56Vo1Pfq5Qy5dXZ3tztUkwO3Jb912XSEQTYJeWscExtul9l3KF7xCnbqF9bxW_tx793Iq9qn0sAtprJ9AKuF31pHBO0XWSLYT7rznLDE8oID8WpkTxa98338r0926IQBQVWpvto5T16QSrMcVKK3lI83Bfbbn" 
              alt="Método Pame" 
              className="w-full h-full object-cover rounded-full" 
            />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.25em]">Método Pame</span>
        </div>

        {/* Catchphrase */}
        <div className="my-auto py-10 md:py-0 z-10 flex flex-col gap-5 text-left">
          <button
            onClick={() => onScreenChange('welcome')}
            className="self-start flex items-center gap-2 text-white/70 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-4 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Voltar ao Início
          </button>
          
          <h1 className="font-display italic text-5xl md:text-6xl lg:text-7xl font-light tracking-tight leading-tight">
            Lista de Espera <br />
            <span className="font-sans font-extrabold text-white text-2xl md:text-3xl lg:text-4xl tracking-normal not-italic block mt-3 opacity-95">
              Acesso Antecipado
            </span>
          </h1>
          <div className="w-20 h-1 bg-white/30 rounded-full my-2" />
          <p className="text-base md:text-lg text-white/85 leading-relaxed max-w-sm">
            Para garantir o padrão de luxo e cuidado absoluto em cada detalhe, limitamos o número de clientes mensais. Garanta sua vaga.
          </p>
        </div>

        {/* Footer */}
        <div className="z-10 pointer-events-none opacity-40">
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase">HIGH-END HOME DETAIL</p>
        </div>
      </div>

      {/* Right side form */}
      <div className="w-full md:w-7/12 flex items-center justify-center p-6 md:p-16 lg:p-24 bg-[#fff7fd]">
        <div className="w-full max-w-xl bg-white rounded-3xl border border-[#efe5ee] shadow-[0_4px_24px_rgba(86,22,104,0.05)] p-8 md:p-12 text-left">
          
          {referrerName && (
            <div className="mb-8 p-5 bg-[#faf1fa] border border-[#efe5ee] rounded-2xl flex items-center gap-4">
              <span className="material-symbols-outlined text-amber-500 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              <div>
                <p className="text-sm font-bold text-[#561668]">Convidada por {referrerName}</p>
                <p className="text-xs text-[#80737f] font-semibold mt-0.5">Seu cadastro receberá prioridade de agendamento.</p>
              </div>
            </div>
          )}

          <h2 className="text-2xl font-extrabold text-[#1e1a20] mb-2">Preencha seus dados</h2>
          <p className="text-sm text-[#4e434e] mb-8 font-medium">Entraremos em contato assim que abrirmos novos dias na agenda.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Nome Completo */}
            <div className="flex flex-col gap-2">
              <label 
                className={`text-[12px] font-extrabold tracking-wider uppercase ml-1 transition-colors ${isFocused === 'name' ? 'text-[#561668]' : 'text-[#703081]'}`}
                htmlFor="wt-name"
              >
                Nome Completo
              </label>
              <input
                id="wt-name"
                type="text"
                required
                placeholder="Digite seu nome completo"
                value={fullName}
                onFocus={() => setIsFocused('name')}
                onBlur={() => setIsFocused(null)}
                onChange={e => setFullName(e.target.value)}
                className="w-full h-14 px-5 bg-[#faf1fa] border border-[#d1c2d0]/70 rounded-xl text-base text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
              />
            </div>

            {/* WhatsApp */}
            <div className="flex flex-col gap-2">
              <label 
                className={`text-[12px] font-extrabold tracking-wider uppercase ml-1 transition-colors ${isFocused === 'whatsapp' ? 'text-[#561668]' : 'text-[#703081]'}`}
                htmlFor="wt-whatsapp"
              >
                WhatsApp
              </label>
              <input
                id="wt-whatsapp"
                type="tel"
                required
                placeholder="(48) 99999-9999"
                value={whatsapp}
                onFocus={() => setIsFocused('whatsapp')}
                onBlur={() => setIsFocused(null)}
                onChange={e => handleWhatsappChange(e.target.value)}
                className="w-full h-14 px-5 bg-[#faf1fa] border border-[#d1c2d0]/70 rounded-xl text-base text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
              />
            </div>

            {/* E-mail */}
            <div className="flex flex-col gap-2">
              <label 
                className={`text-[12px] font-extrabold tracking-wider uppercase ml-1 transition-colors ${isFocused === 'email' ? 'text-[#561668]' : 'text-[#703081]'}`}
                htmlFor="wt-email"
              >
                E-mail
              </label>
              <input
                id="wt-email"
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onFocus={() => setIsFocused('email')}
                onBlur={() => setIsFocused(null)}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-14 px-5 bg-[#faf1fa] border border-[#d1c2d0]/70 rounded-xl text-base text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
              />
            </div>

            {/* Bairro */}
            <div className="flex flex-col gap-2">
              <label 
                className={`text-[12px] font-extrabold tracking-wider uppercase ml-1 transition-colors ${isFocused === 'neighborhood' ? 'text-[#561668]' : 'text-[#703081]'}`}
                htmlFor="wt-neighborhood"
              >
                Bairro de Residência (Tijucas e região)
              </label>
              <div className="relative">
                <select
                  id="wt-neighborhood"
                  required
                  value={neighborhood}
                  onFocus={() => setIsFocused('neighborhood')}
                  onBlur={() => setIsFocused(null)}
                  onChange={e => setNeighborhood(e.target.value)}
                  className="w-full h-14 px-5 bg-[#faf1fa] border border-[#d1c2d0]/70 rounded-xl text-base text-[#1e1a20] appearance-none focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
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
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#703081] pointer-events-none text-2xl">expand_more</span>
              </div>
            </div>

            {/* Frequência de Interesse */}
            <div className="flex flex-col gap-2">
              <label 
                className={`text-[12px] font-extrabold tracking-wider uppercase ml-1 transition-colors ${isFocused === 'frequency' ? 'text-[#561668]' : 'text-[#703081]'}`}
                htmlFor="wt-frequency"
              >
                Qual serviço tem mais interesse?
              </label>
              <div className="relative">
                <select
                  id="wt-frequency"
                  required
                  value={serviceType}
                  onFocus={() => setIsFocused('frequency')}
                  onBlur={() => setIsFocused(null)}
                  onChange={e => setServiceType(e.target.value)}
                  className="w-full h-14 px-5 bg-[#faf1fa] border border-[#d1c2d0]/70 rounded-xl text-base text-[#1e1a20] appearance-none focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                >
                  <option value="" disabled>Selecione o tipo de serviço</option>
                  <option value="Pacote Mensal (4x no mês)">Pacote Mensal (4x no mês) - Recomendado</option>
                  <option value="Serviço Avulso (Limpeza Única)">Serviço Avulso (Limpeza Única)</option>
                  <option value="Limpeza Pós-Obra">Limpeza Pós-Obra</option>
                  <option value="Outro">Outro</option>
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#703081] pointer-events-none text-2xl">expand_more</span>
              </div>
            </div>

            {/* Como conheceu */}
            <div className="flex flex-col gap-2">
              <label 
                className={`text-[12px] font-extrabold tracking-wider uppercase ml-1 transition-colors ${isFocused === 'source' ? 'text-[#561668]' : 'text-[#703081]'}`}
                htmlFor="wt-source"
              >
                Como nos conheceu?
              </label>
              <div className="relative">
                <select
                  id="wt-source"
                  required
                  value={source}
                  onFocus={() => setIsFocused('source')}
                  onBlur={() => setIsFocused(null)}
                  onChange={e => setSource(e.target.value)}
                  className="w-full h-14 px-5 bg-[#faf1fa] border border-[#d1c2d0]/70 rounded-xl text-base text-[#1e1a20] appearance-none focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                >
                  <option value="" disabled>Selecione uma opção</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Indicação de Amigo">Indicação de amigo/cliente</option>
                  <option value="Já era cliente da Pame">Já era cliente da Pame</option>
                  <option value="Outro">Outro</option>
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#703081] pointer-events-none text-2xl">expand_more</span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-[#561668] hover:bg-[#703081] text-sm font-extrabold uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 hover:shadow-lg active:scale-95 cursor-pointer mt-4"
            >
              {isSubmitting ? (
                <span className="material-symbols-outlined animate-spin text-[22px]">sync</span>
              ) : (
                <>
                  Entrar na Lista de Espera
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}
