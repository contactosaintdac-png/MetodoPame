/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TriageData {
  cleaningDate: string; // '<7' | '15-30' | '>30'
  rooms: number;
  baths: number;
  floors: number;
  marble: boolean;
  wood: boolean;
  doubleGlass: boolean;
  chandeliers: boolean;
  frequency: 'monthly' | 'individual' | '';
  address?: string;
  phone?: string;
}

export interface AddonService {
  id: string;
  name: string;
  price: number;
  icon: string;
  description: string;
}

export type ApplicationScreen = 'welcome' | 'acesso' | 'triage' | 'pricing' | 'recruitment' | 'minha-area' | 'admin' | 'waitlist' | 'not-found' | 'verify-certificate';

export interface Employee {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  cpf?: string;
  role: 'Especialista' | 'Admin' | string;
  zones?: string;
  status: 'pending' | 'active' | 'inactive';
  active: boolean;
  photoURL?: string;
  weeklyAvailability?: string[][]; // Array of arrays containing shifts
  createdAt?: string;
  pendingUpdate?: { name?: string; whatsapp?: string; zones?: string; } | null;
  // LMS Training fields
  trainingStatus?: 'not_started' | 'in_progress' | 'completed' | 'certified';
  certificationLevel?: 'Certificada Método Pame' | 'Em Formação' | null;
  certificationDate?: any;
  certificationCode?: string | null;
  trainingStartedAt?: any;
  trainingCompletedAt?: any;
  finalExamScore?: number | null;
  finalExamAttempts?: Array<{
    attemptId: string;
    startedAt: any;
    gradedAt?: any;
    scorePercent: number;
    passed: boolean;
    certificationLevel?: string | null;
  }>;
}

export interface Review {
  stars: number;
  text: string;
  date?: string;
}

export interface Booking {
  id?: string;
  docId?: string;
  name?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  date: string;
  time?: string;
  address?: string;
  shift?: string;
  format?: 'meio' | 'completo';
  modality?: string;
  status: 'Confirmado' | 'Concluído' | 'Cancelado' | 'Pendente';
  totalPrice: number;
  addons?: string[];
  assignedEmployeeId?: string;
  employeeName?: string;
  createdAt?: any;
  review?: Review;
}

export interface Referral {
  id?: string;
  referrerId: string;
  referrerName: string;
  referredId: string;
  referredName: string;
  referredEmail: string;
  bookingId: string;
  status: 'pending' | 'completed' | 'rewarded';
  createdAt: any;
  updatedAt: any;
}

// ─── LMS TYPES ───────────────────────────────────────────────────────────────

export interface LMSModule {
  id: string;
  number: number;
  title: string;
  slug: string;
  description: string;
  objective: string;
  block: 'identidad' | 'postura' | 'conducta' | 'tecnica' | 'estandar' | 'operacion';
  estimatedMinutes: number;
  lessons: string[];
  evaluationId: string;
  prerequisiteModuleId: string | null;
  order: number;
  status: 'draft' | 'published';
  createdAt?: any;
  updatedAt?: any;
}

export interface LMSCompletionCriteria {
  type: 'manual_confirmation' | 'video_watch_threshold';
  thresholdPercent?: number | null;
  buttonLabel?: string | null;
  requiresVideoWatch: boolean;
}

export interface LMSLesson {
  id: string;
  moduleId: string;
  number: number;
  title: string;
  type: 'reading' | 'video' | 'hybrid';
  content: string;
  videoUrl: string | null;
  videoDurationSeconds: number | null;
  estimatedMinutes: number;
  completionCriteria: LMSCompletionCriteria;
  order: number;
  status: 'draft' | 'published';
  createdAt?: any;
  updatedAt?: any;
}

export interface LMSQuestion {
  id: string;
  type: 'multiple_choice' | 'open_short' | 'scenario';
  question: string;
  options: string[] | null;
  correctOptionIndex: number | null;
  expectedAnswerKeywords: string[] | null;
  feedback: string;
  points: number;
  order: number;
}

export interface LMSEvaluation {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  passingScorePercent: number;
  questions: LMSQuestion[];
  totalQuestions: number;
  estimatedMinutes: number;
  maxAttempts: number;
  status: 'draft' | 'published';
  createdAt?: any;
  updatedAt?: any;
}

export interface LMSLessonProgress {
  lessonId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  videoProgressPercent: number | null;
  videoWatchTimeSeconds: number | null;
  completedAt: any;
  lastVisitedAt: any;
}

export interface LMSEvaluationAttempt {
  attemptNumber: number;
  startedAt: any;
  completedAt: any;
  scorePercent: number | null;
  answers: Array<{
    questionId: string;
    answer: string;
    correct: boolean;
  }>;
  passed: boolean;
}

export interface LMSTrainingProgress {
  id: string;
  employeeId: string;
  moduleId: string;
  moduleStatus: 'not_started' | 'in_progress' | 'completed' | 'failed';
  lessonsProgress: LMSLessonProgress[];
  evaluationAttempts: LMSEvaluationAttempt[];
  bestScorePercent: number | null;
  passed: boolean;
  startedAt: any;
  completedAt: any;
  lastActivityAt: any;
}

export interface LMSCertification {
  id: string;
  employeeId: string;
  employeeName: string;
  level: 'Certificada Método Pame' | 'Em Formação';
  finalExamScorePercent: number;
  modulesCompleted: number;
  issuedAt: any;
  issuedBy: string;
  certificateCode: string;
  valid: boolean;
  revokedAt: any;
  revokedReason: string | null;
}

