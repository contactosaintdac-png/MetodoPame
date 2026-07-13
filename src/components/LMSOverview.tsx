import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { LMSModule, Employee } from '../types';

interface LMSOverviewProps {
  employee: Employee;
  onNavigate: (view: 'overview' | 'module' | 'lesson' | 'evaluation' | 'certificate', param?: string, lessonNumber?: number) => void;
  isAdminView?: boolean;
  adminTargetEmployeeId?: string;
}

export default function LMSOverview({ employee, onNavigate, isAdminView = false, adminTargetEmployeeId }: LMSOverviewProps) {
  const [modules, setModules] = useState<LMSModule[]>([]);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const targetEmployeeId = isAdminView ? adminTargetEmployeeId : employee.id;

  useEffect(() => {
    async function fetchData() {
      if (!targetEmployeeId) return;
      try {
        setLoading(true);
        // 1. Fetch modules
        const modSnap = await getDocs(query(collection(db, 'modules'), where('status', '==', 'published')));
        const fetchedModules = modSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LMSModule[];
        fetchedModules.sort((a, b) => a.number - b.number);
        setModules(fetchedModules);

        // 2. Fetch employee progress in modules
        const progSnap = await getDocs(collection(db, 'employees', targetEmployeeId, 'trainingProgress'));
        const progMap: Record<string, any> = {};
        progSnap.docs.forEach(doc => {
          progMap[doc.data().moduleId] = doc.data();
        });
        setProgress(progMap);
      } catch (err) {
        console.error('Error fetching LMS data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [targetEmployeeId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-[#561668] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-[#80737f] font-bold uppercase tracking-wider">Carregando capacitação...</p>
      </div>
    );
  }

  // Calculate stats
  const totalModules = modules.length;
  const completedModules = Object.values(progress).filter((p: any) => p?.passed).length;
  const progressPercent = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
  const readyForFinalExam = completedModules === 15;
  const isCertified = !isAdminView && (employee.trainingStatus === 'certified' || employee.trainingStatus === 'completed');

  // Check if a module is unlocked
  const isModuleUnlocked = (mod: LMSModule, idx: number) => {
    if (idx === 0) return true; // first module is always unlocked
    if (isAdminView) return true; // admin can see everything
    const prevMod = modules[idx - 1];
    return progress[prevMod.id]?.passed === true;
  };

  const getBlockName = (block: string) => {
    switch (block) {
      case 'identidad': return '1. Identidade e Marca';
      case 'postura': return '2. Postura Profissional';
      case 'conducta': return '3. Código de Conduta';
      case 'tecnica': return '4. Técnicas e Protocolos';
      case 'estandar': return '5. O Capricho Pame';
      case 'operacion': return '6. Comunicação e Operação';
      default: return 'Geral';
    }
  };

  // Group modules by block
  const blocks: Record<string, LMSModule[]> = {};
  modules.forEach(m => {
    if (!blocks[m.block]) blocks[m.block] = [];
    blocks[m.block].push(m);
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="bg-[#561668] text-white p-8 rounded-3xl silk-lift-lg relative overflow-hidden mb-8">
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-[#efe5ee]/10 rounded-full blur-xl"></div>
        <div className="absolute right-12 bottom-0 w-32 h-32 bg-[#C9A84C]/10 rounded-full blur-lg"></div>
        
        <div className="relative z-10">
          <span className="bg-[#C9A84C] text-[#561668] text-[9px] px-3 py-1 rounded-full font-bold uppercase tracking-widest">
            {isAdminView ? 'Modo de Monitoramento' : 'Curso Oficial'}
          </span>
          <h1 className="text-3xl font-display italic font-semibold mt-3">Portal de Capacitação</h1>
          <p className="text-[#efe5ee] text-xs uppercase tracking-widest mt-1 font-bold">Método Pame | Home Detail</p>
          
          {isAdminView && (
            <p className="mt-4 text-sm bg-black/20 p-3 rounded-xl border border-white/10">
              Visualizando progresso de: <strong>{employee.name}</strong> ({employee.email})
            </p>
          )}

          {/* Progress bar */}
          <div className="mt-8 flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[#efe5ee]">
              <span>Módulos Concluídos</span>
              <span>{completedModules} / {totalModules} ({progressPercent}%)</span>
            </div>
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#C9A84C] transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Certified Banner */}
      {isCertified && (
        <div className="bg-[#fff7fd] border border-[#C9A84C] p-6 rounded-2xl flex items-center justify-between mb-8 silk-lift-sm">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-[#C9A84C] text-[40px]">workspace_premium</span>
            <div>
              <h3 className="font-bold text-[#561668] text-base">Parabéns! Você concluiu sua formação</h3>
              <p className="text-xs text-[#80737f]">Você está oficialmente certificada como especialista do Método Pame.</p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('certificate')}
            className="bg-[#561668] hover:bg-[#431051] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all silk-lift-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Ver Certificado
          </button>
        </div>
      )}

      {/* Modules Lists grouped by block */}
      <div className="flex flex-col gap-10">
        {Object.entries(blocks).map(([blockKey, blockModules]) => (
          <div key={blockKey} className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-[#561668] uppercase tracking-widest border-b border-[#e9e0e8] pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#C9A84C]">folder_open</span>
              {getBlockName(blockKey)}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {blockModules.map((mod, idx) => {
                const globalIdx = modules.findIndex(m => m.id === mod.id);
                const unlocked = isModuleUnlocked(mod, globalIdx);
                const modProgress = progress[mod.id];
                const passed = modProgress?.passed === true;
                const score = modProgress?.bestScorePercent;

                return (
                  <button
                    key={mod.id}
                    disabled={!unlocked}
                    onClick={() => onNavigate('module', mod.slug)}
                    className={`p-5 rounded-2xl text-left border transition-all duration-300 relative flex items-start justify-between silk-lift-sm ${
                      passed
                        ? 'bg-white border-[#C9A84C]/30 hover:border-[#C9A84C] hover:bg-[#fffdf9]'
                        : unlocked
                        ? 'bg-white border-[#efe5ee] hover:border-[#561668] hover:bg-[#fff7fd]'
                        : 'bg-[#f8f7f9] border-[#efe5ee] opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex-grow pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#80737f] uppercase">Módulo {mod.number}</span>
                        {passed ? (
                          <span className="bg-[#e2f0d9] text-[#385723] text-[9px] px-2 py-0.5 rounded-full font-bold">Concluído</span>
                        ) : unlocked ? (
                          <span className="bg-[#fff7fd] text-[#561668] text-[9px] px-2 py-0.5 rounded-full font-bold">Disponível</span>
                        ) : (
                          <span className="bg-[#f2f2f3] text-[#626264] text-[9px] px-2 py-0.5 rounded-full font-bold">Bloqueado</span>
                        )}
                      </div>
                      
                      <h3 className="font-bold text-[#1e1a20] text-base mt-1.5 leading-tight">{mod.title}</h3>
                      <p className="text-xs text-[#80737f] line-clamp-2 mt-1">{mod.description}</p>
                      
                      <div className="flex items-center gap-4 mt-4 text-[11px] text-[#80737f] font-medium">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">menu_book</span>
                          {mod.lessons.length} lições
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          {mod.estimatedMinutes} min
                        </span>
                        {passed && score !== null && (
                          <span className="text-[#385723] font-bold">
                            Nota: {score}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-[#efe5ee]">
                      {passed ? (
                        <span className="material-symbols-outlined text-[#C9A84C] text-[18px]">verified</span>
                      ) : unlocked ? (
                        <span className="material-symbols-outlined text-[#561668] text-[18px]">arrow_forward</span>
                      ) : (
                        <span className="material-symbols-outlined text-[#80737f] text-[18px]">lock</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Final Exam Section */}
      <div className="mt-12 border-t border-[#e9e0e8] pt-12">
        <div className="bg-white border border-[#efe5ee] p-8 rounded-3xl silk-lift-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-grow">
            <span className="bg-[#ba1a1a]/10 text-[#ba1a1a] text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest">Etapa Final</span>
            <h2 className="text-2xl font-display italic font-semibold text-[#561668] mt-3">Exame de Certificação Final</h2>
            <p className="text-sm text-[#80737f] mt-1.5 max-w-xl">
              Consiste em 40 perguntas sorteadas de todos os módulos. Requer aprovação de **90%** para o nível de *Certificada Método Pame* ou **70%** para o nível *Em Formação*. Cooldown de 24h e limite de 2 tentativas mensais.
            </p>
          </div>

          <div className="flex-shrink-0">
            {readyForFinalExam ? (
              <button 
                onClick={() => onNavigate('evaluation')}
                className="bg-[#561668] hover:bg-[#431051] text-white px-8 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all silk-lift-md"
              >
                Iniciar Exame Final
              </button>
            ) : (
              <button 
                disabled
                className="bg-[#f2f2f3] text-[#d1c2d0] border border-[#efe5ee] px-8 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest cursor-not-allowed flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">lock</span>
                Bloqueado
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
