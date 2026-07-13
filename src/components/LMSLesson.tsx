import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { LMSModule, LMSLesson, Employee } from '../types';

interface LMSLessonProps {
  employee: Employee;
  moduleSlug: string;
  lessonNumber: number;
  onNavigate: (view: 'overview' | 'module' | 'lesson' | 'evaluation' | 'certificate', param?: string, lessonNumber?: number) => void;
  isAdminView?: boolean;
  adminTargetEmployeeId?: string;
}

export default function LMSLessonComponent({ employee, moduleSlug, lessonNumber, onNavigate, isAdminView = false, adminTargetEmployeeId }: LMSLessonProps) {
  const [module, setModule] = useState<LMSModule | null>(null);
  const [lesson, setLesson] = useState<LMSLesson | null>(null);
  const [allLessons, setAllLessons] = useState<LMSLesson[]>([]);
  const [progressDoc, setProgressDoc] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0); // For video/hybrid simulation
  const [videoTimer, setVideoTimer] = useState<any>(null);

  const targetEmployeeId = isAdminView ? adminTargetEmployeeId : employee.id;

  useEffect(() => {
    async function fetchData() {
      if (!moduleSlug || !lessonNumber || !targetEmployeeId) return;
      try {
        setLoading(true);
        // Clear video timer on reload
        if (videoTimer) clearInterval(videoTimer);
        setVideoProgress(0);

        // 1. Fetch current module by slug
        const modSnap = await getDocs(query(collection(db, 'modules'), where('slug', '==', moduleSlug)));
        if (modSnap.empty) {
          onNavigate('overview');
          return;
        }
        const currentMod = { id: modSnap.docs[0].id, ...modSnap.docs[0].data() } as LMSModule;
        setModule(currentMod);

        // 2. Fetch all lessons in module (needed for navigation & initialization)
        const lesSnap = await getDocs(query(collection(db, 'lessons'), where('moduleId', '==', currentMod.id)));
        const fetchedLessons = lesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LMSLesson[];
        fetchedLessons.sort((a, b) => a.number - b.number);
        setAllLessons(fetchedLessons);

        // 3. Find current lesson
        const currentLesson = fetchedLessons.find(l => l.number === lessonNumber);
        if (!currentLesson) {
          console.error('Lesson not found:', lessonNumber);
          onNavigate('module', moduleSlug);
          return;
        }
        setLesson(currentLesson);

        // 4. Fetch progress and initialize if not exists
        const progressId = `${targetEmployeeId}_${currentMod.id}`;
        const progRef = doc(db, 'employees', targetEmployeeId, 'trainingProgress', progressId);
        const progDoc = await getDoc(progRef);

        let lessonsProgList = [];
        if (!progDoc.exists()) {
          if (isAdminView) {
            setCompleted(true);
            setProgressDoc({ lessonsProgress: [] });
            return;
          }
          // Initialize progress document for this module
          lessonsProgList = fetchedLessons.map(l => ({
            lessonId: l.id,
            status: 'not_started',
            videoProgressPercent: null,
            videoWatchTimeSeconds: null,
            completedAt: null,
            lastVisitedAt: null
          }));

          const initialProgress = {
            id: progressId,
            employeeId: targetEmployeeId,
            moduleId: currentMod.id,
            moduleStatus: 'in_progress',
            lessonsProgress: lessonsProgList,
            evaluationAttempts: [],
            bestScorePercent: null,
            passed: false,
            startedAt: serverTimestamp(),
            completedAt: null,
            lastActivityAt: serverTimestamp()
          };

          await setDoc(progRef, initialProgress);
          setProgressDoc(initialProgress);
          setCompleted(false);

          // Update general employee trainingStatus to 'in_progress' if it's 'not_started'
          if (employee.trainingStatus === 'not_started') {
            await updateDoc(doc(db, 'employees', targetEmployeeId), {
              trainingStatus: 'in_progress',
              trainingStartedAt: serverTimestamp()
            });
          }
        } else {
          const data = progDoc.data();
          setProgressDoc(data);
          
          // Check if this lesson is completed
          const currentProg = data.lessonsProgress?.find((lp: any) => lp.lessonId === currentLesson.id);
          const isComp = currentProg?.status === 'completed';
          setCompleted(isComp);

          // Auto start video simulation if not completed and requires video watch
          if (!isAdminView && !isComp && currentLesson.completionCriteria?.requiresVideoWatch) {
            startVideoSimulation(currentLesson, data, progRef);
          }
        }
      } catch (err) {
        console.error('Error fetching lesson:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    return () => {
      if (videoTimer) clearInterval(videoTimer);
    };
  }, [moduleSlug, lessonNumber, targetEmployeeId]);

  // Video simulation watcher
  const startVideoSimulation = (currentLesson: LMSLesson, currentProgData: any, progRef: any) => {
    let currentPercent = 0;
    const interval = setInterval(async () => {
      currentPercent += 10;
      setVideoProgress(Math.min(currentPercent, 100));

      if (currentPercent >= 90) {
        clearInterval(interval);
        // Auto complete lesson
        await completeLesson(currentLesson, currentProgData, progRef);
      }
    }, 1000); // simulation: 10% every second (completes in 10s)
    setVideoTimer(interval);
  };

  const completeLesson = async (currLesson: LMSLesson, currentProgData: any, progRef: any) => {
    if (isAdminView || completing) return;
    setCompleting(true);
    try {
      const updatedLessonsProgress = (currentProgData.lessonsProgress || []).map((lp: any) => {
        if (lp.lessonId === currLesson.id) {
          return {
            ...lp,
            status: 'completed',
            videoProgressPercent: currLesson.completionCriteria.requiresVideoWatch ? 100 : null,
            completedAt: new Date(),
            lastVisitedAt: new Date()
          };
        }
        return lp;
      });

      await updateDoc(progRef, {
        lessonsProgress: updatedLessonsProgress,
        lastActivityAt: serverTimestamp()
      });

      setCompleted(true);
      // Update local state
      setProgressDoc((prev: any) => ({
        ...prev,
        lessonsProgress: updatedLessonsProgress
      }));
    } catch (err) {
      console.error('Error completing lesson:', err);
    } finally {
      setCompleting(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!lesson || !progressDoc || isAdminView) return;
    const progressId = `${targetEmployeeId}_${module?.id}`;
    const progRef = doc(db, 'employees', targetEmployeeId, 'trainingProgress', progressId);
    await completeLesson(lesson, progressDoc, progRef);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-[#561668] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-[#80737f] font-bold uppercase tracking-wider">Carregando lição...</p>
      </div>
    );
  }

  if (!module || !lesson) return null;

  // Next and previous lesson navigation
  const prevLesson = allLessons.find(l => l.number === lesson.number - 1);
  const nextLesson = allLessons.find(l => l.number === lesson.number + 1);

  // Check if next lesson is unlocked (i.e. this lesson must be completed)
  const isNextUnlocked = completed || isAdminView;

  // Custom lightweight markdown parsing to React elements
  const renderMarkdownToReact = (content: string) => {
    if (!content) return null;
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="text-sm font-bold text-[#561668] mt-6 mb-2">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-base font-bold text-[#561668] mt-8 mb-3 border-b border-[#efe5ee] pb-1.5">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={idx} className="text-lg font-bold text-[#561668] mt-10 mb-4">{line.replace('# ', '')}</h2>;
      }
      if (line.startsWith('- ')) {
        const text = line.replace('- ', '');
        return (
          <li key={idx} className="ml-5 list-disc text-xs text-[#4e434e] my-1 leading-relaxed">
            {parseBoldText(text)}
          </li>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }
      return <p key={idx} className="text-xs text-[#4e434e] my-2 leading-relaxed">{parseBoldText(line)}</p>;
    });
  };

  const parseBoldText = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-bold text-[#1e1a20]">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back to module button */}
      <button 
        onClick={() => onNavigate('module', module.slug)}
        className="flex items-center gap-2 text-xs font-bold text-[#80737f] hover:text-[#561668] transition-all mb-6 uppercase tracking-wider"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Voltar para {module.title}
      </button>

      {/* Lesson Container */}
      <div className="bg-white border border-[#efe5ee] p-8 rounded-3xl silk-lift-md mb-8">
        <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest bg-[#fffdf9] border border-[#C9A84C]/20 px-3 py-1 rounded-full">
          Lição {lesson.number} de {allLessons.length}
        </span>
        
        <h1 className="text-2xl font-bold text-[#561668] mt-4 leading-tight">{lesson.title}</h1>
        <p className="text-[10px] text-[#80737f] font-bold uppercase tracking-wider mt-1">{module.title}</p>
        
        {/* Lesson content body */}
        <div className="mt-8 border-t border-[#e9e0e8] pt-6 text-[#4e434e] workspace-markdown font-sans">
          {renderMarkdownToReact(lesson.content)}
        </div>

        {/* Video completion criteria UI */}
        {lesson.completionCriteria?.requiresVideoWatch && (
          <div className="mt-8 bg-[#f8f7f9] p-5 rounded-2xl border border-[#efe5ee]">
            <h4 className="text-xs font-bold text-[#561668] uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">play_circle</span>
              Assistir Vídeo Instrucional (Simulação)
            </h4>
            
            <div className="bg-[#1e1a20] aspect-video w-full rounded-xl overflow-hidden relative flex flex-col justify-end p-4 text-white">
              {/* Play symbol */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[64px] opacity-75 hover:opacity-100 cursor-pointer animate-pulse">play_circle</span>
              </div>
              
              <div className="relative z-10 w-full flex flex-col gap-2 bg-black/40 p-3 rounded-lg backdrop-blur-sm">
                <div className="text-[10px] font-medium tracking-wide">Vídeo de Capacitação Técnica Método Pame</div>
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-grow h-1.5 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full bg-[#C9A84C]" style={{ width: `${videoProgress}%` }}></div>
                  </div>
                  <div className="text-[10px] font-bold shrink-0">{videoProgress}% assistido</div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-[#80737f] mt-3">
              *A lição é completada automaticamente após assistir 90% do vídeo explicativo.
            </p>
          </div>
        )}

        {/* Action Button (manual read) */}
        {!lesson.completionCriteria?.requiresVideoWatch && (
          <div className="mt-8 pt-6 border-t border-[#e9e0e8] flex justify-center">
            {completed ? (
              <div className="bg-[#e2f0d9] text-[#385723] px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border border-[#385723]/10">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                Lição Concluída ✓
              </div>
            ) : (
              <button
                disabled={completing || isAdminView}
                onClick={handleMarkAsRead}
                className="bg-[#561668] hover:bg-[#431051] text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all silk-lift-sm flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {completing ? 'Registrando...' : 'Marcar como Lida'}
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between">
        {prevLesson ? (
          <button 
            onClick={() => onNavigate('lesson', module.slug, prevLesson.number)}
            className="flex items-center gap-1.5 text-xs font-bold text-[#561668] hover:underline"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Anterior ({prevLesson.number})
          </button>
        ) : (
          <div></div>
        )}

        {nextLesson ? (
          <button 
            disabled={!isNextUnlocked}
            onClick={() => onNavigate('lesson', module.slug, nextLesson.number)}
            className={`flex items-center gap-1.5 text-xs font-bold ${
              isNextUnlocked 
                ? 'text-[#561668] hover:underline' 
                : 'text-[#d1c2d0] cursor-not-allowed'
            }`}
          >
            Próxima ({nextLesson.number})
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        ) : (
          <button 
            disabled={!isNextUnlocked}
            onClick={() => onNavigate('module', module.slug)}
            className={`flex items-center gap-1.5 text-xs font-bold ${
              isNextUnlocked 
                ? 'text-[#C9A84C] hover:underline' 
                : 'text-[#d1c2d0] cursor-not-allowed'
            }`}
          >
            Módulo Completo
            <span className="material-symbols-outlined text-[16px]">verified</span>
          </button>
        )}
      </div>
    </div>
  );
}
