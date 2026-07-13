import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { LMSModule, LMSLesson, Employee } from '../types';

interface LMSModuleProps {
  employee: Employee;
  moduleSlug: string;
  onNavigate: (view: 'overview' | 'module' | 'lesson' | 'evaluation' | 'certificate', param?: string, lessonNumber?: number) => void;
  isAdminView?: boolean;
  adminTargetEmployeeId?: string;
}

export default function LMSModuleComponent({ employee, moduleSlug, onNavigate, isAdminView = false, adminTargetEmployeeId }: LMSModuleProps) {
  const [module, setModule] = useState<LMSModule | null>(null);
  const [lessons, setLessons] = useState<LMSLesson[]>([]);
  const [moduleProgress, setModuleProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const targetEmployeeId = isAdminView ? adminTargetEmployeeId : employee.id;

  useEffect(() => {
    async function fetchData() {
      if (!moduleSlug || !targetEmployeeId) return;
      try {
        setLoading(true);
        // 1. Fetch current module by slug
        const modSnap = await getDocs(query(collection(db, 'modules'), where('slug', '==', moduleSlug)));
        if (modSnap.empty) {
          console.error('Module not found for slug:', moduleSlug);
          onNavigate('overview');
          return;
        }
        const currentMod = { id: modSnap.docs[0].id, ...modSnap.docs[0].data() } as LMSModule;
        setModule(currentMod);

        // 2. Fetch lessons for this module
        const lesSnap = await getDocs(query(collection(db, 'lessons'), where('moduleId', '==', currentMod.id)));
        const fetchedLessons = lesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LMSLesson[];
        fetchedLessons.sort((a, b) => a.number - b.number);
        setLessons(fetchedLessons);

        // 3. Fetch trainingProgress for this specific module
        const progDoc = await getDoc(doc(db, 'employees', targetEmployeeId, 'trainingProgress', `${targetEmployeeId}_${currentMod.id}`));
        if (progDoc.exists()) {
          setModuleProgress(progDoc.data());
        }
      } catch (err) {
        console.error('Error loading module details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [moduleSlug, targetEmployeeId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-[#561668] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-[#80737f] font-bold uppercase tracking-wider">Carregando detalhes do módulo...</p>
      </div>
    );
  }

  if (!module) return null;

  // Check lesson completion status
  const lessonsProgress = moduleProgress?.lessonsProgress || [];
  const lessonsProgressMap = new Map<string, string>(); // lessonId -> status
  lessonsProgress.forEach((lp: any) => {
    lessonsProgressMap.set(lp.lessonId, lp.status);
  });

  const isLessonCompleted = (lessonId: string) => {
    return lessonsProgressMap.get(lessonId) === 'completed';
  };

  const isLessonUnlocked = (lesson: LMSLesson, idx: number) => {
    if (idx === 0) return true; // first lesson is always unlocked
    if (isAdminView) return true; // admin can see everything
    const prevLesson = lessons[idx - 1];
    return isLessonCompleted(prevLesson.id);
  };

  // Check if all lessons are completed so they can take the evaluation
  const allLessonsCompleted = lessons.length > 0 && lessons.every(l => isLessonCompleted(l.id));
  const passedModule = moduleProgress?.passed === true;
  const bestScore = moduleProgress?.bestScorePercent;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back button */}
      <button 
        onClick={() => onNavigate('overview')}
        className="flex items-center gap-2 text-sm font-bold text-[#80737f] hover:text-[#561668] transition-all mb-6 uppercase tracking-wider"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Voltar à Visão Geral
      </button>

      {/* Module Title Section */}
      <div className="bg-white border border-[#efe5ee] p-8 rounded-3xl silk-lift-md mb-8">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest bg-[#fffdf9] border border-[#C9A84C]/20 px-3 py-1 rounded-full">
            Módulo {module.number}
          </span>
          <span className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest bg-[#f8f7f9] border border-[#efe5ee] px-3 py-1 rounded-full">
            {module.estimatedMinutes} min estimados
          </span>
        </div>
        
        <h1 className="text-3xl font-display italic font-semibold text-[#561668] mt-4">{module.title}</h1>
        
        <div className="mt-6 border-t border-[#e9e0e8] pt-6 flex flex-col gap-4">
          <div>
            <h4 className="text-xs font-bold text-[#80737f] uppercase tracking-wider">Objetivo de Aprendizado</h4>
            <p className="text-sm text-[#4e434e] mt-1 leading-relaxed">{module.objective}</p>
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#80737f] uppercase tracking-wider">Descrição</h4>
            <p className="text-sm text-[#4e434e] mt-1 leading-relaxed">{module.description}</p>
          </div>
        </div>
      </div>

      {/* Lessons List */}
      <div className="flex flex-col gap-4 mb-10">
        <h2 className="text-sm font-bold text-[#561668] uppercase tracking-widest flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#C9A84C]">menu_book</span>
          Lista de Lições
        </h2>

        <div className="flex flex-col gap-3">
          {lessons.map((lesson, idx) => {
            const unlocked = isLessonUnlocked(lesson, idx);
            const completed = isLessonCompleted(lesson.id);

            return (
              <button
                key={lesson.id}
                disabled={!unlocked}
                onClick={() => onNavigate('lesson', module.slug, lesson.number)}
                className={`p-5 rounded-2xl text-left border transition-all duration-200 relative flex items-center justify-between silk-lift-sm ${
                  completed
                    ? 'bg-white border-[#C9A84C]/20 hover:border-[#C9A84C] hover:bg-[#fffdf9]'
                    : unlocked
                    ? 'bg-white border-[#efe5ee] hover:border-[#561668] hover:bg-[#fff7fd]'
                    : 'bg-[#f8f7f9] border-[#efe5ee] opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-4 pr-4">
                  {/* Number Badge */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    completed
                      ? 'bg-[#e2f0d9] text-[#385723]'
                      : unlocked
                      ? 'bg-[#fff7fd] text-[#561668] border border-[#561668]/15'
                      : 'bg-[#efe5ee] text-[#80737f]'
                  }`}>
                    {lesson.number}
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1e1a20] text-sm leading-tight">{lesson.title}</h3>
                    <p className="text-[11px] text-[#80737f] font-medium mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        {lesson.estimatedMinutes} min
                      </span>
                      <span className="text-[#d1c2d0]">•</span>
                      <span className="uppercase text-[9px] font-bold text-[#C9A84C]">
                        {lesson.type === 'reading' ? 'Leitura' : lesson.type === 'video' ? 'Vídeo' : 'Híbrida'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-[#efe5ee]">
                  {completed ? (
                    <span className="material-symbols-outlined text-[#C9A84C] text-[18px]">verified</span>
                  ) : unlocked ? (
                    <span className="material-symbols-outlined text-[#561668] text-[18px]">play_arrow</span>
                  ) : (
                    <span className="material-symbols-outlined text-[#80737f] text-[18px]">lock</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Module Evaluation Section */}
      <div className="border-t border-[#e9e0e8] pt-8">
        <div className="bg-white border border-[#efe5ee] p-6 rounded-2xl silk-lift-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-[#561668] text-lg">Avaliação do Módulo</h3>
            <p className="text-xs text-[#80737f] mt-1">
              Valide sua compreensão do conteúdo estudado neste módulo. Exige acerto mínimo de **70%**.
            </p>
            {passedModule && (
              <p className="text-xs text-[#385723] font-bold mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Aprovada com nota {bestScore}%!
              </p>
            )}
          </div>
          
          <div>
            {passedModule ? (
              <button
                onClick={() => onNavigate('evaluation', module.slug)}
                className="border border-[#C9A84C] text-[#C9A84C] hover:bg-[#fffdf9] px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all silk-lift-sm"
              >
                Refazer Avaliação
              </button>
            ) : allLessonsCompleted ? (
              <button
                onClick={() => onNavigate('evaluation', module.slug)}
                className="bg-[#561668] hover:bg-[#431051] text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all silk-lift-sm"
              >
                Iniciar Avaliação
              </button>
            ) : (
              <button
                disabled
                className="bg-[#f2f2f3] text-[#d1c2d0] border border-[#efe5ee] px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-not-allowed flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                Conclua as lições
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
