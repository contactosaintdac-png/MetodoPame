import type { User } from 'firebase/auth';

export async function callBookingsApi<T>(
  user: User,
  action: string,
  payload: Record<string, unknown> = {},
  idempotencyKey?: string,
): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
  if (!response.ok) throw new Error(body.message ?? body.error ?? `Booking API failed (${response.status})`);
  return body as T;
}
