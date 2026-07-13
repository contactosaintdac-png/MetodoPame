import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { LMSEvaluation, LMSQuestion, Employee, LMSModule } from '../types';

interface LMSEvaluationProps {
  employee: Employee;
  moduleSlug?: string; // If undefined, it's the final exam!
  onNavigate: (view: 'overview' | 'module' | 'lesson' | 'evaluation' | 'certificate', param?: string, lessonNumber?: number) => void;
  isAdminView?: boolean;
}

export default function LMSEvaluationComponent({ employee, moduleSlug, onNavigate, isAdminView = false }: LMSEvaluationProps) {
  const isFinalExam = !moduleSlug;

  const [evaluation, setEvaluation] = useState<LMSEvaluation | null>(null);
  const [questions, setQuestions] = useState<LMSQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({}); // questionId -> answer string
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Final exam specific states
  const [attemptId, setAttemptId] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(3 * 60 * 60); // 3 hours in seconds
  const [timerActive, setTimerActive] = useState(false);

  // Result display state
  const [result, setResult] = useState<any>(null); // { scorePercent, passed, certificationLevel, feedback: [] }

  const storageKey = isFinalExam ? `lms_final_exam_${attemptId || 'temp'}` : `lms_eval_${moduleSlug}`;

  useEffect(() => {
    async function loadEvaluation() {
      try {
        setLoading(true);
        if (isFinalExam) {
          // 1. Fetch final exam attempt from backend
          const idToken = await auth.currentUser?.getIdToken();
          const response = await fetch('/api/generate-final-exam', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ employeeId: employee.id })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Erro ao gerar exame final.');
          }

          const data = await response.json();
          setAttemptId(data.attemptId);
          setQuestions(data.questions);
          
          // Reconstruct timer based on startedAt if resumed
          if (data.resumed) {
            // Fetch attempt doc to get startedAt
            const attemptDoc = await getDoc(doc(db, 'employees', employee.id!, 'final_exam_attempts', data.attemptId));
            if (attemptDoc.exists()) {
              const startedAt = attemptDoc.data().startedAt.toDate();
              const diffSecs = Math.floor((new Date().getTime() - startedAt.getTime()) / 1000);
              const remaining = Math.max((3 * 60 * 60) - diffSecs, 0);
              setTimeLeft(remaining);
            }
          }
          setTimerActive(true);

          // Restore partial answers from localStorage if attemptId is loaded
          const partialKey = `lms_final_exam_${data.attemptId}`;
          const savedAnswers = localStorage.getItem(partialKey);
          if (savedAnswers) {
            try {
              setUserAnswers(JSON.parse(savedAnswers));
            } catch (e) {
              console.error('Error parsing saved answers:', e);
            }
          }
        } else {
          // 2. Fetch module evaluation client-side
          // Fetch module ID first
          const modSnap = await getDocs(query(collection(db, 'modules'), where('slug', '==', moduleSlug)));
          if (modSnap.empty) throw new Error('Module not found');
          const mod = modSnap.docs[0].data() as LMSModule;

          const evaDoc = await getDoc(doc(db, 'evaluations', mod.evaluationId));
          if (!evaDoc.exists()) throw new Error('Evaluation not found');
          const eva = { id: evaDoc.id, ...evaDoc.data() } as LMSEvaluation;
          setEvaluation(eva);
          setQuestions(eva.questions || []);

          // Restore partial answers from localStorage
          const savedAnswers = localStorage.getItem(`lms_eval_${moduleSlug}`);
          if (savedAnswers) {
            try {
              setUserAnswers(JSON.parse(savedAnswers));
            } catch (e) {
              console.error('Error parsing saved answers:', e);
            }
          }
        }
      } catch (err: any) {
        console.error('Error loading evaluation:', err);
        alert(err.message || 'Erro ao carregar.');
        onNavigate('overview');
      } finally {
        setLoading(false);
      }
    }
    loadEvaluation();
  }, [moduleSlug]);

  // Final Exam Timer Effect
  useEffect(() => {
    let timerInterval: any = null;
    if (timerActive && timeLeft > 0) {
      timerInterval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            // Auto submit when time ends
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [timerActive, timeLeft]);

  // Persist answers to localStorage when they change
  const saveAnswer = (questionId: string, answer: string) => {
    const updated = { ...userAnswers, [questionId]: answer };
    setUserAnswers(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleAutoSubmit = () => {
    alert('O tempo limite do exame expirou! Suas respostas serão enviadas automaticamente.');
    submitExam();
  };

  // Grading client-side for module evaluations
  const gradeModuleEvaluation = async () => {
    if (!evaluation || !employee.id) return;
    setSubmitting(true);
    try {
      let earnedPoints = 0;
      let totalPoints = 0;
      const gradedAnswers: any[] = [];
      const feedbackList: any[] = [];

      questions.forEach(q => {
        const answer = userAnswers[q.id] || '';
        const points = q.points || 1;
        totalPoints += points;
        
        let correct = false;
        if (q.type === 'multiple_choice') {
          if (parseInt(answer, 10) === q.correctOptionIndex) {
            correct = true;
            earnedPoints += points;
          }
        } else {
          // Open short or scenario checks keywords case-insensitive, normalizing accents
          const cleanAnswer = cleanText(answer);
          const keywords = q.expectedAnswerKeywords || [];
          const matches = keywords.filter(kw => cleanAnswer.includes(cleanText(kw)));
          const threshold = Math.ceil(keywords.length * 0.75);
          if (keywords.length === 0 || matches.length >= threshold) {
            correct = true;
            earnedPoints += points;
          }
        }

        gradedAnswers.push({
          questionId: q.id,
          answer,
          correct
        });

        feedbackList.push({
          questionId: q.id,
          questionText: q.question,
          correct,
          clientAnswer: answer,
          feedback: q.feedback
        });
      });

      const scorePercent = Math.round((earnedPoints / totalPoints) * 100);
      const passed = scorePercent >= evaluation.passingScorePercent;

      // Save progress to Firestore
      const progressId = `${employee.id}_${evaluation.moduleId}`;
      const progRef = doc(db, 'employees', employee.id, 'trainingProgress', progressId);
      
      const progDoc = await getDoc(progRef);
      const data = progDoc.exists() ? progDoc.data() : {};
      
      const pastAttempts = data.evaluationAttempts || [];
      const newAttempt = {
        attemptNumber: pastAttempts.length + 1,
        startedAt: data.startedAt || new Date(),
        completedAt: new Date(),
        scorePercent,
        answers: gradedAnswers,
        passed
      };

      const bestScore = data.bestScorePercent === null ? scorePercent : Math.max(data.bestScorePercent, scorePercent);

      await updateDoc(progRef, {
        evaluationAttempts: [...pastAttempts, newAttempt],
        bestScorePercent: bestScore,
        passed: data.passed || passed,
        moduleStatus: (data.passed || passed) ? 'completed' : 'failed',
        completedAt: (data.passed || passed) ? serverTimestamp() : null,
        lastActivityAt: serverTimestamp()
      });

      // Clear localStorage
      localStorage.removeItem(storageKey);

      setResult({
        scorePercent,
        passed,
        feedback: feedbackList
      });

    } catch (err) {
      console.error('Error grading evaluation:', err);
      alert('Erro ao processar as respostas. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper text cleaner
  const cleanText = (text: string) => {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  };

  // Grading server-side for final exam
  const submitExam = async () => {
    if (!employee.id || submitting) return;
    setSubmitting(true);
    setTimerActive(false);
    try {
      const answersArray = questions.map(q => ({
        questionId: q.id,
        answer: userAnswers[q.id] || ''
      }));

      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/grade-final-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          employeeId: employee.id,
          attemptId,
          answers: answersArray
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao corrigir o examen final.');
      }

      const data = await response.json();
      
      // Clear localStorage
      localStorage.removeItem(storageKey);

      setResult({
        scorePercent: data.scorePercent,
        passed: data.passed,
        certificationLevel: data.certificationLevel,
        certificationCode: data.certificationCode,
        feedback: data.feedback
      });

    } catch (err: any) {
      console.error('Error submitting exam:', err);
      alert(err.message || 'Erro ao enviar respostas.');
      setTimerActive(true);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-[#561668] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-[#80737f] font-bold uppercase tracking-wider">Iniciando avaliação...</p>
      </div>
    );
  }

  // ─── VIEW: RESULTS PAGE ───────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white border border-[#efe5ee] p-8 rounded-3xl silk-lift-lg text-center mb-8">
          <span className="material-symbols-outlined text-[64px] mb-4 block" style={{ color: result.passed ? '#C9A84C' : '#ba1a1a' }}>
            {result.passed ? 'verified' : 'cancel'}
          </span>
          
          <h1 className="text-3xl font-display italic font-semibold text-[#561668]">
            {result.passed ? 'Parabéns! Você Aprovou!' : 'Avaliação Não Aprovada'}
          </h1>
          
          <p className="text-sm text-[#80737f] mt-2">
            {isFinalExam 
              ? `Resultado do Exame de Certificação: ${result.certificationLevel || 'Em Formação'}` 
              : 'Resultado da Avaliação do Módulo'}
          </p>

          <div className="mt-6 flex justify-center gap-6 text-center">
            <div>
              <span className="text-3xl font-bold text-[#561668]">{result.scorePercent}%</span>
              <span className="block text-[10px] text-[#80737f] uppercase tracking-wider font-bold mt-1">Pontuação</span>
            </div>
            <div className="w-px bg-[#efe5ee] self-stretch"></div>
            <div>
              <span className="text-3xl font-bold text-[#561668]">{result.passed ? 'Aprovado' : 'Reprovado'}</span>
              <span className="block text-[10px] text-[#80737f] uppercase tracking-wider font-bold mt-1">Estatus</span>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-4">
            {result.passed && isFinalExam && (
              <button 
                onClick={() => onNavigate('certificate')}
                className="bg-[#561668] hover:bg-[#431051] text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all silk-lift-sm flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Ver Certificado
              </button>
            )}
            <button 
              onClick={() => onNavigate('overview')}
              className="border border-[#efe5ee] text-[#561668] hover:bg-[#fff7fd] px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all silk-lift-sm"
            >
              Voltar à Visão Geral
            </button>
          </div>
        </div>

        {/* Detailed feedback list */}
        <div className="flex flex-col gap-6">
          <h2 className="text-sm font-bold text-[#561668] uppercase tracking-widest">Revisão Detalhada</h2>
          {result.feedback.map((item: any, i: number) => (
            <div key={i} className={`p-6 rounded-2xl border bg-white silk-lift-sm ${
              item.correct ? 'border-[#e2f0d9]' : 'border-[#ba1a1a]/20'
            }`}>
              <div className="flex items-start gap-3 justify-between">
                <h4 className="font-bold text-sm text-[#1e1a20] leading-snug">
                  {i + 1}. {item.questionText}
                </h4>
                <span className={`material-symbols-outlined shrink-0 text-[20px] ${
                  item.correct ? 'text-[#385723]' : 'text-[#ba1a1a]'
                }`}>
                  {item.correct ? 'check_circle' : 'cancel'}
                </span>
              </div>

              {/* Answers block */}
              <div className="mt-4 bg-[#f8f7f9] p-4 rounded-xl text-xs text-[#80737f] flex flex-col gap-2">
                <div>
                  <span className="font-bold uppercase text-[9px] text-[#561668] block">Sua Resposta:</span>
                  <span className="text-[#1e1a20] font-medium">{item.clientAnswer || '[Nenhuma respuesta]'}</span>
                </div>
              </div>

              {/* Feedback text */}
              <div className="mt-4 border-t border-[#efe5ee] pt-4 text-xs text-[#4e434e]">
                <strong className="text-[#561668] uppercase text-[9px] block mb-1">Explicação técnica:</strong>
                {item.feedback}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── VIEW: QUESTION FLOW ─────────────────────────────────────────────────────
  const currentQuestion = questions[currentIdx];
  const progressPercent = questions.length > 0 ? Math.round(((currentIdx + 1) / questions.length) * 100) : 0;
  const currentAnswer = userAnswers[currentQuestion?.id] || '';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="text-[10px] font-bold text-[#80737f] uppercase tracking-widest bg-[#f8f7f9] border border-[#efe5ee] px-3 py-1 rounded-full">
            {isFinalExam ? 'Exame de Certificação Final' : `Avaliação Módulo`}
          </span>
          <h2 className="text-xs font-bold text-[#561668] uppercase tracking-widest mt-3">
            Questão {currentIdx + 1} de {questions.length}
          </h2>
        </div>

        {isFinalExam && (
          <div className="flex items-center gap-1.5 bg-[#ba1a1a]/10 text-[#ba1a1a] px-4 py-2 rounded-xl text-xs font-bold font-mono">
            <span className="material-symbols-outlined text-[16px] animate-pulse">schedule</span>
            {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-[#efe5ee] rounded-full overflow-hidden mb-8">
        <div className="h-full bg-[#561668] transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
      </div>

      {/* Question container */}
      <div className="bg-white border border-[#efe5ee] p-8 rounded-3xl silk-lift-md mb-8">
        <h3 className="font-bold text-[#1e1a20] text-lg leading-snug mb-6">
          {currentQuestion?.question}
        </h3>

        {/* 1. Multiple Choice options */}
        {currentQuestion?.type === 'multiple_choice' && (
          <div className="flex flex-col gap-3">
            {currentQuestion.options?.map((option, oIdx) => {
              const isSelected = currentAnswer === String(oIdx);
              return (
                <button
                  key={oIdx}
                  onClick={() => saveAnswer(currentQuestion.id, String(oIdx))}
                  className={`p-4 rounded-xl border text-left text-xs font-medium transition-all flex items-center gap-3 ${
                    isSelected
                      ? 'border-[#561668] bg-[#fff7fd] text-[#561668] font-bold silk-lift-sm'
                      : 'border-[#efe5ee] hover:bg-[#f8f7f9] text-[#4e434e]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-[#561668] bg-[#561668]' : 'border-[#efe5ee]'
                  }`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                  </div>
                  {option}
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Open short or scenario textareas */}
        {currentQuestion?.type !== 'multiple_choice' && (
          <div className="flex flex-col gap-2">
            <textarea
              value={currentAnswer}
              onChange={(e) => saveAnswer(currentQuestion.id, e.target.value)}
              placeholder="Escreva sua resposta técnica detalhada em português..."
              rows={6}
              className="w-full rounded-2xl border border-[#efe5ee] p-4 text-xs font-medium outline-none focus:border-[#561668] focus:bg-[#fff7fd] transition-all text-[#1e1a20] resize-none"
            ></textarea>
            <p className="text-[10px] text-[#80737f] italic mt-1">
              *Nota: Sua resposta será corrigida automaticamente verificando conceitos fundamentais. Seja clara e precisa.
            </p>
          </div>
        )}
      </div>

      {/* Navigation footer buttons */}
      <div className="flex items-center justify-between">
        <button
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx(prev => prev - 1)}
          className="flex items-center gap-1.5 text-xs font-bold text-[#561668] hover:underline disabled:text-[#d1c2d0] disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          Anterior
        </button>

        {currentIdx < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIdx(prev => prev + 1)}
            className="bg-[#561668] hover:bg-[#431051] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all silk-lift-sm flex items-center gap-1"
          >
            Próxima
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        ) : (
          <button
            disabled={submitting || isAdminView}
            onClick={isFinalExam ? submitExam : gradeModuleEvaluation}
            className="bg-[#C9A84C] hover:bg-[#b0913e] text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all silk-lift-sm flex items-center gap-2"
          >
            {submitting ? 'Corrigindo...' : 'Finalizar e Enviar'}
            <span className="material-symbols-outlined text-[16px]">send</span>
          </button>
        )}
      </div>
    </div>
  );
}
