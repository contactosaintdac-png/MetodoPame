import { useEffect, useState } from 'react';
import type { Employee, LMSModule } from '../types';
import { lmsApi } from '../lib/lms-api';

interface LMSOverviewProps {
  employee: Employee;
  onNavigate: (view: 'overview' | 'module' | 'lesson' | 'evaluation' | 'certificate', param?: string, lessonNumber?: number) => void;
  isAdminView?: boolean;
  adminTargetEmployeeId?: string;
}
type Catalog = { modules: LMSModule[]; progress: Array<{ moduleId: string; lessonsCompleted: string[]; evaluation: { state: string; scorePercent: number; policyState: string } | null }>; professional: { trainingState: string; certificationState: string } };

export default function LMSOverview({ employee, onNavigate, isAdminView = false, adminTargetEmployeeId }: LMSOverviewProps) {
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [error, setError] = useState('');
  useEffect(() => { lmsApi<Catalog>('catalog', { query: isAdminView && adminTargetEmployeeId ? { professionalUid: adminTargetEmployeeId } : {} }).then(setCatalog).catch((reason) => setError(reason.message)); }, [isAdminView, adminTargetEmployeeId]);
  if (!catalog && !error) return <div className="py-20 text-center text-sm text-[#80737f]">Carregando capacitação...</div>;
  if (error) return <div className="py-20 text-center text-sm text-[#ba1a1a]">{error}</div>;
  const completed = catalog!.progress.filter((item) => item.evaluation?.state === 'submitted').length;
  return <div className="max-w-4xl mx-auto px-4 py-8">
    <div className="bg-[#561668] text-white p-8 rounded-3xl mb-8"><span className="text-[10px] uppercase tracking-widest">{isAdminView ? 'Modo de monitoramento' : 'Portal de capacitação'}</span><h1 className="text-3xl font-display italic mt-3">Método Pame</h1><p className="text-xs mt-3 text-[#efe5ee]">{completed} de {catalog!.modules.length} avaliações enviadas. A conclusão da capacitação não certifica nem ativa operações.</p>{isAdminView && <p className="mt-3 text-xs">Visualizando: {employee.name}</p>}</div>
    <div className="grid gap-3">{catalog!.modules.map((module) => { const progress = catalog!.progress.find((item) => item.moduleId === module.id); return <button key={module.id} onClick={() => onNavigate('module', module.slug)} className="text-left bg-white border border-[#efe5ee] rounded-2xl p-5 hover:border-[#561668]/40"><div className="flex justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-[#C9A84C]">Módulo {module.number}</p><h2 className="font-bold text-[#561668] mt-1">{module.title}</h2><p className="text-xs text-[#80737f] mt-2">{module.description}</p></div><span className="text-xs text-[#80737f]">{progress?.evaluation ? `Nota: ${progress.evaluation.scorePercent}%` : 'Pendente'}</span></div></button>; })}</div>
    {!isAdminView && <button className="mt-8 bg-[#561668] text-white px-5 py-3 rounded-xl text-xs font-bold" onClick={() => onNavigate('evaluation')}>Iniciar avaliação final</button>}
    {catalog!.professional.certificationState === 'certified' && <button className="mt-4 border border-[#C9A84C] px-5 py-3 rounded-xl text-xs font-bold text-[#561668]" onClick={() => onNavigate('certificate')}>Ver certificado de formação</button>}
  </div>;
}
