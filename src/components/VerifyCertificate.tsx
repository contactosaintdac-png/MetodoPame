import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LMSCertification } from '../types';

interface VerifyCertificateProps {
  certificateCode?: string; // Optional: can be passed by router
  onBackToApp?: () => void;
}

export default function VerifyCertificate({ certificateCode: propCode, onBackToApp }: VerifyCertificateProps) {
  // If no code is in props, try to get it from URL path params
  const [code, setCode] = useState(propCode || '');
  const [loading, setLoading] = useState(false);
  const [certification, setCertification] = useState<LMSCertification | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    // If code was passed in props or URL (we read URL path in App.tsx and set this prop)
    if (propCode) {
      handleVerify(propCode);
    } else {
      // Check current window URL path for /verificar-certificado/CODE
      const pathParts = window.location.pathname.split('/');
      const codeIdx = pathParts.indexOf('verificar-certificado');
      if (codeIdx !== -1 && pathParts[codeIdx + 1]) {
        const urlCode = pathParts[codeIdx + 1];
        setCode(urlCode);
        handleVerify(urlCode);
      }
    }
  }, [propCode]);

  const handleVerify = async (codeToVerify: string) => {
    const trimmed = codeToVerify.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    setCertification(null);
    try {
      const docRef = doc(db, 'certifications', trimmed);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setCertification({ id: docSnap.id, ...docSnap.data() } as LMSCertification);
      } else {
        setCertification(null);
      }
    } catch (err) {
      console.error('Error verifying certificate:', err);
      setCertification(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(code);
  };

  return (
    <div className="min-h-screen bg-[#fff7fd] flex flex-col justify-between font-sans">
      {/* Navbar header */}
      <header className="bg-white border-b border-[#e9e0e8] py-4 px-6 flex items-center justify-between silk-lift-sm">
        <div className="flex items-center gap-2">
          <img 
            src="/assets/logo.png" 
            alt="Método Pame" 
            className="w-8 h-8 object-cover rounded-lg border border-[#efe5ee]"
            onError={(e) => {
              // Fallback if logo not found
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="font-display italic font-semibold text-[#561668] text-base leading-tight">Método Pame</h1>
            <p className="text-[8px] text-[#80737f] uppercase tracking-widest font-bold">Residential Excellence</p>
          </div>
        </div>

        {onBackToApp && (
          <button 
            onClick={onBackToApp}
            className="text-xs font-bold text-[#561668] hover:underline uppercase tracking-wider"
          >
            Voltar ao Aplicativo
          </button>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white border border-[#efe5ee] rounded-3xl p-8 silk-lift-md">
          <div className="text-center mb-8">
            <span className="bg-[#561668]/10 text-[#561668] text-[9px] px-3 py-1 rounded-full font-bold uppercase tracking-widest">
              Validação de Credenciais
            </span>
            <h2 className="text-2xl font-bold text-[#561668] mt-3">Verificar Certificado</h2>
            <p className="text-xs text-[#80737f] mt-1">
              Consulte a autenticidade e validade de uma especialista certificada.
            </p>
          </div>

          {/* Form input */}
          <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: MP-CERT-2026-emp_001-A4B7C9"
              className="flex-grow rounded-xl border border-[#efe5ee] px-4 py-3 text-xs font-medium outline-none focus:border-[#561668] focus:bg-[#fff7fd] transition-all text-[#1e1a20]"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#561668] hover:bg-[#431051] text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all silk-lift-sm shrink-0"
            >
              {loading ? 'Buscando...' : 'Verificar'}
            </button>
          </form>

          {/* Verification Results */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-8 h-8 border-3 border-[#561668] border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {!loading && searched && (
            <div>
              {certification && certification.valid ? (
                // SUCCESS CARD
                <div className="bg-[#fffdf9] border-2 border-[#C9A84C]/40 rounded-2xl p-6 relative overflow-hidden silk-lift-sm">
                  {/* Watermark badge */}
                  <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[#C9A84C]/5 text-[128px] pointer-events-none">
                    verified_user
                  </span>

                  <div className="flex items-center gap-3 text-[#C9A84C] font-bold text-sm mb-4">
                    <span className="material-symbols-outlined text-[24px]">verified</span>
                    CERTIFICADO VÁLIDO
                  </div>

                  <div className="flex flex-col gap-3 relative z-10 text-xs">
                    <div>
                      <span className="text-[9px] text-[#80737f] uppercase tracking-wider font-bold block">Especialista</span>
                      <span className="text-sm font-bold text-[#1e1a20]">{certification.employeeName}</span>
                    </div>

                    <div>
                      <span className="text-[9px] text-[#80737f] uppercase tracking-wider font-bold block">Nível de Qualificação</span>
                      <span className="text-[#561668] font-bold">{certification.level}</span>
                    </div>

                    <div className="flex justify-between border-t border-[#efe5ee] pt-3 mt-1">
                      <div>
                        <span className="text-[9px] text-[#80737f] uppercase tracking-wider font-bold block">Data de Emissão</span>
                        <span className="font-semibold text-[#4e434e]">
                          {certification.issuedAt?.toDate ? certification.issuedAt.toDate().toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-[#80737f] uppercase tracking-wider font-bold block">Aproveitamento</span>
                        <span className="font-bold text-[#1e1a20]">{certification.finalExamScorePercent}% no Exame</span>
                      </div>
                    </div>

                    <div className="border-t border-[#efe5ee] pt-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#385723] text-[16px]">check_circle</span>
                      <span className="text-[10px] text-[#385723] font-bold">Registro ativo e autorizado</span>
                    </div>
                  </div>
                </div>
              ) : (
                // FAILURE CARD
                <div className="bg-[#fff7fd] border-2 border-[#ba1a1a]/20 rounded-2xl p-6 text-center silk-lift-sm">
                  <span className="material-symbols-outlined text-[#ba1a1a] text-[48px] mb-2">warning</span>
                  <h4 className="font-bold text-[#ba1a1a] text-sm">Registro Não Encontrado ou Inválido</h4>
                  <p className="text-[11px] text-[#80737f] mt-1">
                    O código inserido não corresponde a nenhum certificado emitido pelo Método Pame ou foi revogado.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="py-6 border-t border-[#e9e0e8] bg-white text-center text-[10px] text-[#80737f] font-medium tracking-wide">
        &copy; {new Date().getFullYear()} Método Pame | Todos os direitos reservados.
      </footer>
    </div>
  );
}
