import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { HttpError } from '../http-errors.js';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

export function commandPayloadHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export function commandReceiptId(actorUid: string, action: string, idempotencyKey: string): string {
  return createHash('sha256').update(`${actorUid}:${action}:${idempotencyKey}`).digest('hex');
}

export async function runIdempotentCommand<TResult extends Record<string, unknown>>(input: {
  db: Firestore;
  actorUid: string;
  action: string;
  idempotencyKey: string;
  payload: unknown;
  execute(tx: Transaction): Promise<TResult> | TResult;
}): Promise<TResult> {
  const receiptRef = input.db.collection('booking_command_receipts')
    .doc(commandReceiptId(input.actorUid, input.action, input.idempotencyKey));
  const payloadHash = commandPayloadHash(input.payload);
  return input.db.runTransaction(async (tx) => {
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      if (receipt.get('payloadHash') !== payloadHash) {
        throw new HttpError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used with a different payload');
      }
      return receipt.get('result') as TResult;
    }
    const result = await input.execute(tx);
    tx.create(receiptRef, {
      schemaVersion: 1, actorUid: input.actorUid, action: input.action,
      idempotencyKey: input.idempotencyKey, payloadHash, result,
      createdAt: new Date(),
    });
    return result;
  });
}
