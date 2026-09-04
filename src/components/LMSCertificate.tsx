import { useEffect, useState } from 'react';
import type { Employee } from '../types';
import { lmsApi } from '../lib/lms-api';

interface LMSCertificateProps { employee: Employee; onNavigate: (view: 'overview') => void; }
type Certificate = { employeeName: string; code: string; level: string; issuedAt: { seconds?: number } | null; disclaimer: string };

export default function LMSCertificate({ onNavigate }: LMSCertificateProps) {
  const [certificate, setCertificate] = useState<Certificate | null | undefined>(undefined); const [error, setError] = useState('');
  useEffect(() => { lmsApi<Certificate | null>('certificate').then(setCertificate).catch((reason) => { setError(reason.message); setCertificate(null); }); }, []);
  if (certificate === undefined) return <div className="py-20 text-center">Carregando certificado...</div>;
  if (!certificate) return <div className="max-w-md mx-auto text-center py-20"><h2 className="font-bold text-[#561668]">Certificado não disponível</h2><p className="text-xs text-[#80737f] mt-3">A formação, a certificação e a ativação operacional são decisões separadas. {error}</p><button onClick={() => onNavigate('overview')} className="mt-6 text-xs text-[#561668]">Voltar ao portal</button></div>;
  const date = certificate.issuedAt?.seconds ? new Date(certificate.issuedAt.seconds * 1000).toLocaleDateString('pt-BR') : '—';
  return <div className="max-w-2xl mx-auto px-4 py-8"><button className="text-xs text-[#561668] mb-6" onClick={() => onNavigate('overview')}>← Voltar</button><section className="bg-[#561668] border-8 border-[#C9A84C] rounded-3xl p-10 text-center text-white"><p className="text-xs uppercase tracking-[.25em] text-[#C9A84C]">Método Pame</p><h1 className="text-3xl font-display italic mt-5">Certificado de Formação</h1><p className="mt-10 text-sm">Certificamos a conclusão da formação Método Pame de</p><h2 className="text-2xl font-bold text-[#C9A84C] mt-4">{certificate.employeeName}</h2><p className="mt-8 text-xs text-white/80">{certificate.disclaimer}</p><div className="border-t border-white/20 mt-8 pt-5 flex justify-between text-xs"><span>Código: {certificate.code}</span><span>Emitido: {date}</span></div></section></div>;
}
