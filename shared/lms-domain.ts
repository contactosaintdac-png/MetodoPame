/** Server-owned LMS contracts. Client payloads intentionally omit answer keys. */
export const LMS_ATTEMPT_STATES = ['in_progress', 'submitted'] as const;
export type LmsAttemptState = (typeof LMS_ATTEMPT_STATES)[number];

export interface LmsClientQuestion {
  id: string;
  type: 'multiple_choice' | 'open_short' | 'scenario';
  question: string;
  options: string[] | null;
  points: number;
  order: number;
}

export interface LmsAnswer { questionId: string; answer: string; }
export interface LmsAttemptResult { attemptId: string; state: 'submitted'; scorePercent: number; policyState: 'pending_human_policy'; }

export function toClientQuestion(question: Record<string, unknown>): LmsClientQuestion {
  return { id: String(question.id), type: question.type as LmsClientQuestion['type'], question: String(question.question ?? ''), options: Array.isArray(question.options) ? question.options.map(String) : null, points: typeof question.points === 'number' && question.points > 0 ? question.points : 1, order: typeof question.order === 'number' ? question.order : 0 };
}

export function normalizeForScoring(text: string): string { return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }

/** Grades a private server snapshot and returns no key or evaluation criterion. */
export function gradeServerQuestionSnapshot(questions: Array<Record<string, unknown>>, answers: readonly LmsAnswer[]) {
  const answersById = new Map(answers.map((answer) => [answer.questionId, answer.answer.trim()]));
  let total = 0; let earned = 0;
  const privateAnswers: Array<{ questionId: string; answer: string; correct: boolean }> = [];
  for (const question of questions) {
    const points = typeof question.points === 'number' && question.points > 0 ? question.points : 1;
    const answer = answersById.get(String(question.id)) ?? ''; let correct = false;
    if (question.type === 'multiple_choice') correct = Number.parseInt(answer, 10) === question.correctOptionIndex;
    else if (question.type === 'open_short' || question.type === 'scenario') {
      const expected = Array.isArray(question.expectedAnswerKeywords) ? question.expectedAnswerKeywords.map((value) => normalizeForScoring(String(value))).filter(Boolean) : [];
      correct = expected.length === 0 || expected.filter((keyword) => normalizeForScoring(answer).includes(keyword)).length >= Math.ceil(expected.length * 0.75);
    }
    total += points; if (correct) earned += points; privateAnswers.push({ questionId: String(question.id), answer, correct });
  }
  return { scorePercent: total === 0 ? 0 : Math.round((earned / total) * 100), privateAnswers };
}
