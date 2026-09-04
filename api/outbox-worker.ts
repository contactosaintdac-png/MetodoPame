import type { VercelRequest, VercelResponse } from '@vercel/node';

import { applyNoStore } from './_lib/http-policy.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';
import { createExternalEffectAdapter, deleteR7TestCalendarEvent, diagnoseR7TestCalendar } from './_lib/payments/external-effect-adapter.js';
import { processOutboxJobs } from './_lib/payments/outbox-service.js';
import { reconcilePayments } from './_lib/payments/reconciliation-service.js';
import { authenticateCron } from './_lib/service-auth.js';
import { assertOutboxProcessingEnabled, assertWebhookProcessingEnabled } from './_lib/payments/rollout-gate.js';
import { createPaidBookingActionHandler } from './_lib/paid-action-handler.js';
import { readDataModelFlags } from './_lib/data/feature-flags.js';
import { assertR7PreviewCanonicalOwnerAccess, assertR7PreviewTestAccess, assertR7PreviewTestOwnerAccess, processR7PreviewTestJob } from './_lib/payments/r7-preview-test-service.js';
import { createOneShotR7OwnerTestCheckoutPreference, createR7TestCheckoutPreference } from './_lib/payments/r7-preview-test-checkout.js';

const communicationHandlers = {
  admin_notification: createPaidBookingActionHandler('communications.send', 'Admin booking notification'),
  confirmation: createPaidBookingActionHandler('communications.send', 'Booking confirmation'),
  specialist_assignment: createPaidBookingActionHandler('communications.send', 'Professional assignment notification'),
  whatsapp: createPaidBookingActionHandler(
    'communications.send',
    'WhatsApp booking communication',
    ['booking_confirmed', 'professional_assigned', 'professional_removed', 'booking_reminder', 'address_revealed'],
  ),
};

function queryAction(req: VercelRequest): string | undefined {
  const value = req.query.action;
  return Array.isArray(value) ? value[0] : value;
}

function r7TestBody(body: unknown): { jobId: string; now?: string; operation: 'process' | 'cleanup_calendar' } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  const value = body as Record<string, unknown>;
  if (!('jobId' in value)) throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  if (Object.keys(value).some((key) => key !== 'jobId' && key !== 'now' && key !== 'operation') || typeof value.jobId !== 'string') throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  if (value.now !== undefined && (typeof value.now !== 'string' || Number.isNaN(Date.parse(value.now)))) throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  if (value.operation !== undefined && value.operation !== 'process' && value.operation !== 'cleanup_calendar') throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  return { jobId: value.jobId, now: value.now as string | undefined, operation: (value.operation as 'process' | 'cleanup_calendar' | undefined) ?? 'process' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyNoStore(res);
  try {
    const action = queryAction(req);
    if (action === 'r7_preview_test_diagnostic') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
      assertR7PreviewTestAccess(process.env, typeof req.headers['x-r7-test-capability'] === 'string' ? req.headers['x-r7-test-capability'] : undefined);
      let serviceAccountJson = false; let serviceAccountFields = false;
      try {
        const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? '') as { client_email?: unknown; private_key?: unknown };
        serviceAccountJson = true; serviceAccountFields = typeof parsed.client_email === 'string' && typeof parsed.private_key === 'string';
      } catch { /* Boolean-only Preview diagnostic; never return the secret. */ }
      return res.status(200).json({ r7Test: true, calendarIdPresent: Boolean(process.env.GOOGLE_CALENDAR_ID), serviceAccountKeyPresent: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY), serviceAccountJson, serviceAccountFields });
    }
    if (action === 'r7_preview_test_calendar_access') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
      assertR7PreviewTestAccess(process.env, typeof req.headers['x-r7-test-capability'] === 'string' ? req.headers['x-r7-test-capability'] : undefined);
      return res.status(200).json({ r7Test: true, ...(await diagnoseR7TestCalendar()) });
    }
    if (action === 'r7_preview_test_checkout_preference') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
      const capability = typeof req.headers['x-r7-test-capability'] === 'string' ? req.headers['x-r7-test-capability'] : undefined;
      try {
        assertR7PreviewTestAccess(process.env, capability);
        return res.status(200).json({ r7Test: true, ...(await createR7TestCheckoutPreference()) });
      } catch (error) {
        if (!(error instanceof HttpError) || error.code !== 'NOT_FOUND') throw error;
      }
      await assertR7PreviewTestOwnerAccess(req);
      return res.status(200).json({ r7Test: true, temporaryOwnerAuth: true, ...(await createOneShotR7OwnerTestCheckoutPreference()) });
    }
    if (action === 'r7_preview_test_owner_diagnostic') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
      await assertR7PreviewCanonicalOwnerAccess(req);
      const r7TestModeEnabled = process.env.R7_TEST_MODE === 'enabled';
      const flags = readDataModelFlags();
      // Boolean-only Preview evidence. No UID, token, secret, or provider access is logged.
      console.info('r7_preview_owner_diagnostic', { canonicalOwner: true, r7TestModeEnabled, flags });
      return res.status(200).json({ r7Test: true, canonicalOwner: true, r7TestModeEnabled, flags });
    }
    if (action === 'r7_preview_test') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
      assertR7PreviewTestAccess(process.env, typeof req.headers['x-r7-test-capability'] === 'string' ? req.headers['x-r7-test-capability'] : undefined);
      const body = r7TestBody(req.body);
      if (body.operation === 'cleanup_calendar') {
        if (!body.jobId.startsWith('r7_test_')) throw new HttpError(400, 'R7_TEST_FIXTURE_INVALID', 'Invalid R7 test job');
        const job = await (await import('./_lib/firebase-admin.js')).getAdminFirestore().collection('r7_test_outbox_jobs').doc(body.jobId).get();
        const providerReference = job.get('providerReference');
        if (!job.exists || job.get('testMarker') !== 'R7_TEST' || typeof providerReference !== 'string' || !providerReference.startsWith('calendar:')) throw new HttpError(400, 'R7_TEST_FIXTURE_INVALID', 'Invalid R7 test calendar job');
        await deleteR7TestCalendarEvent({ eventId: providerReference.slice('calendar:'.length) });
        await job.ref.update({ calendarCleanupAt: new Date() });
        return res.status(200).json({ r7Test: true, calendarDeleted: true });
      }
      const result = await processR7PreviewTestJob({ jobId: body.jobId, now: body.now ? new Date(body.now) : undefined });
      return res.status(200).json({ r7Test: true, state: result.state, providerReference: result.providerReference });
    }
    if (action && action in communicationHandlers) {
      return communicationHandlers[action as keyof typeof communicationHandlers](req, res);
    }
    const actor = authenticateCron(req);
    if (!actor.permissions.includes('system.cron.execute')) throw new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
    if (action === 'payment_reconciliation') {
      assertWebhookProcessingEnabled();
      return res.status(200).json(await reconcilePayments({}));
    }
    assertOutboxProcessingEnabled();
    const result = await processOutboxJobs({ workerId: 'vercel-cron', adapters: createExternalEffectAdapter() });
    return res.status(200).json(result);
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ error: httpError.code, message: httpError.message });
  }
}
