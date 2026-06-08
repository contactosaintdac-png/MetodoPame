/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ChangeEvent, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ApplicationScreen } from '../types';

interface RecruitmentFormProps {
  onScreenChange: (screen: ApplicationScreen) => void;
}

export default function RecruitmentForm({ onScreenChange }: RecruitmentFormProps) {
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [cpf, setCpf] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [references, setReferences] = useState('');
  const [uploadedPhoto, setUploadedPhoto] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFocused, setIsFocused] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const newEmp = {
        name: fullName,
        cpf: cpf,
        whatsapp: whatsapp,
        experience: experience,
        skills: skills,
        references: references,
        role: 'Especialista em Limpeza',
        active: false,
        status: 'pending',
        assignedServices: 0,
        weeklyAvailability: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: [] },
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=561668&color=fff`,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'employees'), newEmp);

      setIsLoading(false);
      setIsSuccess(true);
      
      // Clear values
      setFullName('');
      setDob('');
      setCpf('');
      setWhatsapp('');
      setExperience('');
      setSkills('');
      setReferences('');
      setUploadedPhoto(null);
      setUploadedFile(null);
    } catch (error) {
      console.error("Erro ao registrar especialista:", error);
      alert("Ocorreu um erro ao enviar sua avaliação. Tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-[#fff7fd]">
      <main className="max-w-7xl mx-auto py-10 px-4 md:px-12 flex flex-col md:flex-row gap-10 items-start justify-center">
        
        {/* Left Column (Context Info matching Image 4) */}
        <div className="w-full md:w-5/12 flex flex-col gap-6 md:sticky md:top-6">
          <div className="relative w-full h-72 rounded-2xl overflow-hidden silk-shadow bg-[#f4ebf4]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#561668]/10 to-transparent z-10" />
            <img
              alt="Especialistas PAME"
              className="w-full h-full object-cover grayscale opacity-90 transition-transform duration-[1500ms] hover:scale-105"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAucqlbhBj0BQPWcsER41eUZHYH6hPDNMzik5buj3UNffWMXUNmeah53g1iz3nZWVT-ulL7V7QeMxDpMfC_qBTSmvRCSlADDFJ51i6fnQO5-03CUatQ4NQsWJ0yps2SOfKmopKriT6tFfVppG0595louVR_h8GcwCmTz7COcXs4m-q53_UeNFua0i5cDkewea_TepvC-VDlBdzpLWfJITIp3dpUmp05YXNeGNIoEPzW-FrMLDtlpFOJxiI9Yd3aHANevsMBSYKT0Mmq"
            />
          </div>
          
          <div className="flex flex-col gap-4">
            <h1 className="font-sans text-3xl md:text-4xl font-extrabold text-[#561668] tracking-tight leading-tight">
              Especialistas PAME<br />
              <span className="text-[#80737f] text-xl font-normal">Alto Padrão</span>
            </h1>
            <div className="w-16 h-1.5 bg-[#703081] rounded-full" />
            
            <p className="font-sans text-[15px] md:text-base text-[#4e434e] leading-relaxed">
              Buscamos profissionais definidos pela <strong className="text-[#561668] font-bold">Maturidade Operacional</strong>. O rigor técnico e a discrição absoluta são os pilares da nossa entrega em lares de altíssimo padrão.
            </p>
            <p className="font-sans text-xs md:text-sm text-[#80737f] leading-relaxed">
              Preencha o formulário ao lado para iniciar seu processo de avaliação confidencial. Todas as informações são protegidas e isoladas do escopo comercial.
            </p>
          </div>
        </div>

        {/* Right Column (Form matching Image 4) */}
        <div className="w-full md:w-7/12 bg-white rounded-2xl border border-[#efe5ee] silk-shadow p-6 md:p-8">
          <AnimatePresence mode="wait">
            {!isSuccess ? (
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-5">
                
                {/* Nome Completo */}
                <div className="flex flex-col gap-1.5">
                  <label 
                    className={`font-sans text-[11px] font-extrabold tracking-widest uppercase ml-1 transition-colors ${
                      isFocused === 'fullName' ? 'text-[#561668]' : 'text-[#703081]'
                    }`}
                    htmlFor="fullName"
                  >
                    Nome Completo
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    placeholder="Seu nome completo"
                    value={fullName}
                    onFocus={() => setIsFocused('fullName')}
                    onBlur={() => setIsFocused(null)}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-12 px-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl font-sans text-sm text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  />
                </div>

                {/* Data de Nascimento */}
                <div className="flex flex-col gap-1.5">
                  <label 
                    className={`font-sans text-[11px] font-extrabold tracking-widest uppercase ml-1 transition-colors ${
                      isFocused === 'dob' ? 'text-[#561668]' : 'text-[#703081]'
                    }`}
                    htmlFor="dob"
                  >
                    Data de Nascimento
                  </label>
                  <input
                    id="dob"
                    type="date"
                    required
                    value={dob}
                    onFocus={() => setIsFocused('dob')}
                    onBlur={() => setIsFocused(null)}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full h-12 px-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl font-sans text-sm text-[#1e1a20] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  />
                </div>

                {/* CPF */}
                <div className="flex flex-col gap-1.5">
                  <label 
                    className={`font-sans text-[11px] font-extrabold tracking-widest uppercase ml-1 transition-colors ${
                      isFocused === 'cpf' ? 'text-[#561668]' : 'text-[#703081]'
                    }`}
                    htmlFor="cpf"
                  >
                    CPF
                  </label>
                  <input
                    id="cpf"
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={cpf}
                    onFocus={() => setIsFocused('cpf')}
                    onBlur={() => setIsFocused(null)}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full h-12 px-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl font-sans text-sm text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  />
                </div>

                {/* WhatsApp */}
                <div className="flex flex-col gap-1.5">
                  <label 
                    className={`font-sans text-[11px] font-extrabold tracking-widest uppercase ml-1 transition-colors ${
                      isFocused === 'whatsapp' ? 'text-[#561668]' : 'text-[#703081]'
                    }`}
                    htmlFor="whatsapp"
                  >
                    WhatsApp
                  </label>
                  <input
                    id="whatsapp"
                    type="tel"
                    required
                    placeholder="(48) 99999-9999"
                    value={whatsapp}
                    onFocus={() => setIsFocused('whatsapp')}
                    onBlur={() => setIsFocused(null)}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full h-12 px-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl font-sans text-sm text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                  />
                </div>

                {/* Tempo de Experiência (Mín. 3 anos) */}
                <div className="flex flex-col gap-1.5">
                  <label 
                    className={`font-sans text-[11px] font-extrabold tracking-widest uppercase ml-1 transition-colors ${
                      isFocused === 'experience' ? 'text-[#561668]' : 'text-[#703081]'
                    }`}
                    htmlFor="experience"
                  >
                    Tempo de Experiência (Mín. 3 anos)
                  </label>
                  <div className="relative">
                    <select
                      id="experience"
                      required
                      value={experience}
                      onFocus={() => setIsFocused('experience')}
                      onBlur={() => setIsFocused(null)}
                      onChange={(e) => setExperience(e.target.value)}
                      className="w-full h-12 px-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl font-sans text-sm text-[#1e1a20] appearance-none focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all"
                    >
                      <option value="" disabled className="text-[#80737f]">
                        Selecione o tempo de experiência
                      </option>
                      <option value="3-5">3 a 5 anos</option>
                      <option value="5-10">5 a 10 anos</option>
                      <option value="10+">Mais de 10 anos</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#703081] pointer-events-none text-2xl">
                      expand_more
                    </span>
                  </div>
                </div>



                {/* Habilidades Específicas */}
                <div className="flex flex-col gap-1.5">
                  <label 
                    className={`font-sans text-[11px] font-extrabold tracking-widest uppercase ml-1 transition-colors ${
                      isFocused === 'skills' ? 'text-[#561668]' : 'text-[#703081]'
                    }`}
                    htmlFor="skills"
                  >
                    Habilidades Específicas
                  </label>
                  <textarea
                    id="skills"
                    rows={2}
                    placeholder="Ex: Limpeza de vidros, cuidados com mármore..."
                    value={skills}
                    onFocus={() => setIsFocused('skills')}
                    onBlur={() => setIsFocused(null)}
                    onChange={(e) => setSkills(e.target.value)}
                    className="w-full p-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl font-sans text-sm text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all resize-none"
                  />
                </div>

                {/* 2 Referências Profissionais */}
                <div className="flex flex-col gap-1.5">
                  <label 
                    className={`font-sans text-[11px] font-extrabold tracking-widest uppercase ml-1 transition-colors ${
                      isFocused === 'references' ? 'text-[#561668]' : 'text-[#703081]'
                    }`}
                    htmlFor="references"
                  >
                    2 Referências Profissionais
                  </label>
                  <textarea
                    id="references"
                    required
                    rows={3}
                    placeholder="Nome, empresa e telefone de contato"
                    value={references}
                    onFocus={() => setIsFocused('references')}
                    onBlur={() => setIsFocused(null)}
                    onChange={(e) => setReferences(e.target.value)}
                    className="w-full p-4 bg-[#faf1fa] border border-[#d1c2d0]/65 rounded-xl font-sans text-sm text-[#1e1a20] placeholder-[#80737f] focus:outline-none focus:border-[#561668] focus:ring-1 focus:ring-[#561668] transition-all resize-none"
                  />
                </div>

                {/* Documentos */}
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Foto Profissional Upload */}
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="font-sans text-[11px] font-extrabold tracking-widest uppercase text-[#703081] ml-1">
                      Foto Profissional
                    </label>
                    <div className="w-full relative bg-[#faf1fa] border-2 border-dashed border-[#d1c2d0] rounded-xl p-6 flex flex-col items-center justify-center gap-3 group cursor-pointer hover:bg-[#efe5ee]/40 transition-colors">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => e.target.files && setUploadedPhoto(e.target.files[0])}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-12 h-12 bg-[#703081] text-white rounded-full flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300">
                        <span className="material-symbols-outlined text-[24px]">add_photo_alternate</span>
                      </div>
                      <div className="text-center">
                        <p className="font-sans text-sm font-bold text-[#561668]">Foto de Perfil</p>
                        <p className="font-sans text-[11px] text-[#80737f] mt-1 font-semibold truncate max-w-[120px]">
                          {uploadedPhoto ? uploadedPhoto.name : 'JPG ou PNG (Máx 5MB)'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Antecedentes Criminais Upload */}
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="font-sans text-[11px] font-extrabold tracking-widest uppercase text-[#703081] ml-1">
                      Antecedentes
                    </label>
                    <div className="w-full relative bg-[#faf1fa] border-2 border-dashed border-[#d1c2d0] rounded-xl p-6 flex flex-col items-center justify-center gap-3 group cursor-pointer hover:bg-[#efe5ee]/40 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-12 h-12 bg-[#703081] text-white rounded-full flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300">
                        <span className="material-symbols-outlined text-[24px]">upload_file</span>
                      </div>
                      <div className="text-center">
                        <p className="font-sans text-sm font-bold text-[#561668]">Anexar PDF</p>
                        <p className="font-sans text-[11px] text-[#80737f] mt-1 font-semibold truncate max-w-[120px]">
                          {uploadedFile ? uploadedFile.name : 'PDF ou Imagem'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="mt-2 pt-6 border-t border-[#efe5ee]">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-14 bg-[#561668] hover:bg-[#703081] text-white font-sans text-xs font-bold uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 hover:shadow-lg active:scale-98 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                        <span>Verificando referências...</span>
                      </>
                    ) : (
                      <>
                        <span>Submeter Avaliação</span>
                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                  
                  <div className="flex items-center justify-center gap-2 mt-4 text-[#80737f]">
                    <span className="material-symbols-outlined text-sm font-bold">lock</span>
                    <p className="font-sans text-[10px] tracking-widest uppercase font-bold">
                      Processo protegido por sigilo absoluto
                    </p>
                  </div>
                </div>

              </form>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-10 text-center gap-5"
              >
                <div className="w-20 h-20 bg-[#efe5ee] rounded-full flex items-center justify-center text-[#561668] shadow-md animate-bounce">
                  <span className="material-symbols-outlined text-4xl">verified</span>
                </div>
                <div>
                  <h2 className="font-sans text-2xl font-black text-[#561668]">Avaliação Enviada com Sucesso!</h2>
                  <p className="text-[#80737f] text-xs font-bold uppercase tracking-widest mt-1">
                    Método Pame • Processo de Seleção
                  </p>
                </div>
                <div className="bg-[#faf1fa] p-5 rounded-2xl border border-[#efe5ee] text-xs text-[#4e434e] max-w-md leading-relaxed">
                  <p className="font-semibold text-[#561668] mb-2">Suas informações de maturidade foram salvas:</p>
                  <p className="text-left font-sans flex flex-col gap-1 text-[#1e1a20]">
                    <span>• Status: Recebido em Sigilo Absoluto</span>
                    <span>• Próximo Passo: Entraremos em contato com as suas 2 referências residenciais.</span>
                    <span>• Tempo estimado: Até 48 horas úteis.</span>
                  </p>
                </div>
                <button
                  onClick={() => setIsSuccess(false)}
                  className="mt-2 px-6 py-2.5 bg-[#561668] hover:bg-[#703081] text-white text-xs tracking-wider uppercase font-extrabold rounded-lg transition-colors cursor-pointer"
                >
                  Novo Cadastro
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Footer limited for brand integrity */}
      <footer className="w-full py-8 mt-10 text-center border-t border-[#efe5ee]">
        <p className="font-sans text-[10px] text-[#80737f] tracking-[0.3em] uppercase font-bold">
          © 2026 METODO PAME. USO INTERNO RESTRITO.
        </p>
      </footer>
    </div>
  );
}
