import { useEffect, useState } from 'react';
import type { Employee, LMSLesson, LMSModule } from '../types';
import { lmsApi } from '../lib/lms-api';

interface LMSModuleProps { employee: Employee; moduleSlug: string; onNavigate: (view: 'overview' | 'lesson' | 'evaluation', param?: string, lessonNumber?: number) => void; isAdminView?: boolean; adminTargetEmployeeId?: string; }
type Catalog = { modules: LMSModule[]; lessons: LMSLesson[]; progress: Array<{ moduleId: string; lessonsCompleted: string[]; evaluation: { state: string; scorePercent: number } | null }> };

export default function LMSModule({ moduleSlug, onNavigate, isAdminView = false, adminTargetEmployeeId }: LMSModuleProps) {
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [error, setError] = useState('');
  useEffect(() => { lmsApi<Catalog>('catalog', { query: isAdminView && adminTargetEmployeeId ? { professionalUid: adminTargetEmployeeId } : {} }).then(setCatalog).catch((reason) => setError(reason.message)); }, [isAdminView, adminTargetEmployeeId]);
  if (!catalog && !error) return <div className="py-20 text-center">Carregando módulo...</div>; if (error) return <div className="py-20 text-center text-[#ba1a1a]">{error}</div>;
  const module = catalog!.modules.find((item) => item.slug === moduleSlug); if (!module) return <div className="py-20 text-center">Módulo não encontrado.</div>;
  const lessons = catalog!.lessons.filter((item) => item.moduleId === module.id).sort((a, b) => a.order - b.order); const progress = catalog!.progress.find((item) => item.moduleId === module.id); const complete = new Set(progress?.lessonsCompleted ?? []);
  return <div className="max-w-4xl mx-auto px-4 py-8"><button className="text-xs text-[#561668] mb-6" onClick={() => onNavigate('overview')}>← Voltar</button><h1 className="text-3xl font-display italic text-[#561668]">{module.title}</h1><p className="text-sm text-[#80737f] mt-2">{module.objective}</p><div className="mt-8 grid gap-3">{lessons.map((lesson) => <button key={lesson.id} onClick={() => onNavigate('lesson', module.slug, lesson.number)} className="text-left bg-white border border-[#efe5ee] p-5 rounded-2xl flex justify-between"><span><b>{lesson.number}. {lesson.title}</b><small className="block text-[#80737f] mt-1">{lesson.estimatedMinutes} min · {lesson.type}</small></span><span>{complete.has(lesson.id) ? '✓' : '→'}</span></button>)}</div><div className="mt-8 bg-white border border-[#efe5ee] p-5 rounded-2xl flex justify-between items-center"><div><b>Avaliação do módulo</b><p className="text-xs text-[#80737f] mt-1">A correção é feita no servidor. Critérios de aprovação permanecem pendentes de definição.</p></div><button className="bg-[#561668] text-white px-4 py-3 rounded-xl text-xs" onClick={() => onNavigate('evaluation', module.slug)}>Iniciar</button></div></div>;
}
