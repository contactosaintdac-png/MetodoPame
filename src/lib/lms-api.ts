import { auth } from './firebase';

function idempotencyKey(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export async function lmsApi<T>(action: string, options: { method?: 'GET' | 'POST'; body?: Record<string, unknown>; query?: Record<string, string> } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sessão necessária para acessar a capacitação.');
  const query = new URLSearchParams({ action, ...(options.query ?? {}) });
  const response = await fetch(`/api/lms?${query}`, { method, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? data.error ?? 'Não foi possível concluir esta ação.');
  return data as T;
}

export function lmsCommandKey(prefix: string): string { return idempotencyKey(prefix); }
