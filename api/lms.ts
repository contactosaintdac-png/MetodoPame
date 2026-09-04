import type { VercelRequest, VercelResponse } from '@vercel/node';

import { authenticate } from './_lib/authenticate.js';
import { authorize } from './_lib/authorize.js';
import { getAdminAuth } from './_lib/firebase-admin.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';
import { applyNoStore, applyPublicCors } from './_lib/http-policy.js';
import { enforcePublicRateLimit } from './_lib/rate-limit.js';
import { rejectUnknownKeys, requireIdempotencyKey, requireObject, requireResourceId, requireString } from './_lib/request-validation.js';
import { completeLmsLesson, getLmsCatalog, getLmsCertificate, startFinalExam, startModuleEvaluation, submitFinalExam, submitModuleEvaluation, verifyLmsCertificate } from './_lib/lms-service.js';

function actionOf(req: VercelRequest): string { return typeof req.query.action === 'string' ? req.query.action : ''; }
function parseAnswers(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) throw new HttpError(400, 'INVALID_PAYLOAD', 'answers is invalid');
  const answers = value.map((item, index) => {
    const answer = requireObject(item, `answers[${index}]`);
    rejectUnknownKeys(answer, ['questionId', 'answer']);
    return { questionId: requireResourceId(answer.questionId, 'questionId'), answer: requireString(answer.answer, 'answer', { min: 0, max: 4000 }) };
  });
  if (new Set(answers.map((item) => item.questionId)).size !== answers.length) throw new HttpError(400, 'INVALID_PAYLOAD', 'answers contains duplicate questions');
  return answers;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyNoStore(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const action = actionOf(req);
  try {
    // Public verification intentionally returns a minimal safe projection only.
    if (action === 'verify-certificate') {
      applyPublicCors(req, res, ['GET']);
      if (req.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
      await enforcePublicRateLimit(req, 'certificate-verification', { limit: 20, windowMs: 60_000 });
      return res.status(200).json(await verifyLmsCertificate({ certificateCode: requireResourceId(req.query.code, 'code') }));
    }
    const identity = await authenticate(req, getAdminAuth());
    const actor = action === 'catalog'
      ? await authorize(identity, ['training.consume', 'training.review'], { requirementMode: 'any' })
      : await authorize(identity, 'training.consume');
    if (action === 'catalog' && req.method === 'GET') return res.status(200).json(await getLmsCatalog({ actor, professionalUid: typeof req.query.professionalUid === 'string' ? requireResourceId(req.query.professionalUid, 'professionalUid') : undefined }));
    if (action === 'certificate' && req.method === 'GET') return res.status(200).json(await getLmsCertificate({ actor }));
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    const body = requireObject(req.body);
    if (action === 'lesson.complete') {
      rejectUnknownKeys(body, ['moduleId', 'lessonId', 'idempotencyKey']);
      return res.status(200).json(await completeLmsLesson({ actor, moduleId: requireResourceId(body.moduleId, 'moduleId'), lessonId: requireResourceId(body.lessonId, 'lessonId'), idempotencyKey: requireIdempotencyKey(body.idempotencyKey) }));
    }
    if (action === 'module.start') {
      rejectUnknownKeys(body, ['moduleId', 'idempotencyKey']);
      return res.status(200).json(await startModuleEvaluation({ actor, moduleId: requireResourceId(body.moduleId, 'moduleId'), idempotencyKey: requireIdempotencyKey(body.idempotencyKey) }));
    }
    if (action === 'module.submit') {
      rejectUnknownKeys(body, ['attemptId', 'answers', 'idempotencyKey']);
      return res.status(200).json(await submitModuleEvaluation({ actor, attemptId: requireResourceId(body.attemptId, 'attemptId'), answers: parseAnswers(body.answers), idempotencyKey: requireIdempotencyKey(body.idempotencyKey) }));
    }
    if (action === 'final.start' || action === 'generate-final-exam') {
      rejectUnknownKeys(body, ['idempotencyKey']);
      return res.status(200).json(await startFinalExam({ actor, idempotencyKey: requireIdempotencyKey(body.idempotencyKey) }));
    }
    if (action === 'final.submit' || action === 'grade-final-exam') {
      rejectUnknownKeys(body, ['attemptId', 'answers', 'idempotencyKey']);
      return res.status(200).json(await submitFinalExam({ actor, attemptId: requireResourceId(body.attemptId, 'attemptId'), answers: parseAnswers(body.answers), idempotencyKey: requireIdempotencyKey(body.idempotencyKey) }));
    }
    if (action === 'migrate-employees') return res.status(410).json({ error: 'MIGRATION_ENDPOINT_DISABLED', message: 'Historical LMS migration is dry-run only and requires review.' });
    throw new HttpError(400, 'INVALID_ACTION', 'Invalid LMS action');
  } catch (error) {
    const known = toHttpError(error);
    if (known.status >= 500) console.error('[LMS API] Internal error');
    return res.status(known.status).json({ error: known.code, message: known.message });
  }
}
