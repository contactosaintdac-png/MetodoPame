import type { VercelRequest, VercelResponse } from '@vercel/node';

import { authorize, type AuthorizedActor } from './_lib/authorize.js';
import { authenticate, type AuthenticatedIdentity } from './_lib/authenticate.js';
import { AVAILABILITY_SHIFTS, type AvailabilityShift } from './_lib/availability-read-model.js';
import { createConciergeReadModel, type ConciergeReadModel } from './_lib/concierge-read-model.js';
import { applyNoStore } from './_lib/http-policy.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';
import {
  rejectUnknownKeys,
  requireEnum,
  requireIsoDate,
  requireObject,
  requireResourceId,
} from './_lib/request-validation.js';

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

interface ProviderToolCall {
  id: string;
  function: { name: string; arguments?: string };
}

interface ProviderMessage {
  role: string;
  content?: string | null;
  tool_calls?: ProviderToolCall[];
}

export interface ChatDependencies {
  authenticate(req: VercelRequest): Promise<AuthenticatedIdentity>;
  authorize(identity: AuthenticatedIdentity): Promise<AuthorizedActor>;
  readModel: ConciergeReadModel;
  complete(messages: unknown[], tools: unknown[]): Promise<ProviderMessage>;
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'listar_minhas_reservas',
      description: 'Lista somente as reservas da cliente autenticada.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obter_minha_reserva',
      description: 'Consulta uma reserva da cliente autenticada pelo ID.',
      parameters: {
        type: 'object',
        properties: { booking_id: { type: 'string' } },
        required: ['booking_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_disponibilidade',
      description: 'Consulta disponibilidade agregada, sem identificar profissionais.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          shift: { type: 'string', enum: [...AVAILABILITY_SHIFTS] },
        },
        required: ['date', 'shift'],
        additionalProperties: false,
      },
    },
  },
] as const;

const SYSTEM_INSTRUCTION = `Você é o concierge do Método Pame.
Responda sempre em português brasileiro, com no máximo três linhas.
Você pode apenas consultar informações da cliente autenticada e disponibilidade agregada.
Você não pode criar, cancelar, reagendar, confirmar ou atribuir reservas, nem enviar mensagens ou eventos de calendário.
Se pedirem uma alteração, explique brevemente que a equipe humana precisa realizá-la.`;

function parseTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new HttpError(400, 'INVALID_PAYLOAD', 'contents must contain 1 to 20 messages');
  }
  let total = 0;
  return value.map((entry, index) => {
    const message = requireObject(entry, `contents[${index}]`);
    rejectUnknownKeys(message, ['role', 'parts']);
    const role = requireEnum(message.role, 'role', ['user', 'model'] as const);
    if (!Array.isArray(message.parts) || message.parts.length !== 1) {
      throw new HttpError(400, 'INVALID_PAYLOAD', 'Each message must contain one text part');
    }
    const part = requireObject(message.parts[0], 'part');
    rejectUnknownKeys(part, ['text']);
    if (typeof part.text !== 'string') {
      throw new HttpError(400, 'INVALID_PAYLOAD', 'Message text is required');
    }
    const text = part.text.trim();
    if (!text || text.length > 4_000) {
      throw new HttpError(400, 'INVALID_PAYLOAD', 'Message text is invalid');
    }
    total += text.length;
    if (total > 20_000) {
      throw new HttpError(400, 'INVALID_PAYLOAD', 'Conversation is too large');
    }
    return { role, text };
  });
}

async function executeReadTool(
  actorUid: string,
  name: string,
  rawArguments: unknown,
  readModel: ConciergeReadModel,
): Promise<unknown> {
  const args = requireObject(rawArguments, 'tool arguments');
  if (name === 'listar_minhas_reservas') {
    rejectUnknownKeys(args, []);
    return { reservations: await readModel.listOwnBookings(actorUid) };
  }
  if (name === 'obter_minha_reserva') {
    rejectUnknownKeys(args, ['booking_id']);
    const bookingId = requireResourceId(args.booking_id, 'booking_id');
    return { reservation: await readModel.getOwnBooking(actorUid, bookingId) };
  }
  if (name === 'consultar_disponibilidade') {
    rejectUnknownKeys(args, ['date', 'shift']);
    const date = requireIsoDate(args.date);
    const shift = requireEnum(args.shift, 'shift', AVAILABILITY_SHIFTS) as AvailabilityShift;
    return { date, shift, available: await readModel.getAvailability(date, shift) };
  }
  throw new HttpError(400, 'UNSUPPORTED_AI_TOOL', 'Unsupported AI tool');
}

async function defaultComplete(messages: unknown[], tools: unknown[]): Promise<ProviderMessage> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, 'AI_PROVIDER_UNAVAILABLE', 'AI provider is unavailable');
  }
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'meta/llama-3.3-70b-instruct',
      messages,
      tools,
      temperature: 0.3,
      max_tokens: 500,
    }),
  });
  if (!response.ok) {
    throw new HttpError(502, 'AI_PROVIDER_ERROR', 'AI provider request failed');
  }
  const data = (await response.json()) as { choices?: Array<{ message?: ProviderMessage }> };
  const message = data.choices?.[0]?.message;
  if (!message) throw new HttpError(502, 'AI_PROVIDER_ERROR', 'AI provider returned no message');
  return message;
}

const defaultDependencies: ChatDependencies = {
  authenticate,
  authorize: (identity) => authorize(identity, 'assistant.chat.use'),
  readModel: createConciergeReadModel(),
  complete: defaultComplete,
};

export function createChatHandler(dependencies: ChatDependencies = defaultDependencies) {
  return async function chatHandler(req: VercelRequest, res: VercelResponse) {
    applyNoStore(res);
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
    }
    try {
      const identity = await dependencies.authenticate(req);
      const actor = await dependencies.authorize(identity);
      const body = requireObject(req.body);
      rejectUnknownKeys(body, ['contents']);
      const turns = parseTurns(body.contents);
      const messages: unknown[] = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...turns.map((turn) => ({
          role: turn.role === 'model' ? 'assistant' : 'user',
          content: turn.text,
        })),
      ];

      for (let round = 0; round < 4; round += 1) {
        const message = await dependencies.complete(messages, [...TOOLS]);
        messages.push(message);
        if (!message.tool_calls?.length) {
          return res.status(200).json({ text: message.content ?? '' });
        }
        for (const toolCall of message.tool_calls) {
          let args: unknown = {};
          try {
            args = JSON.parse(toolCall.function.arguments ?? '{}');
          } catch {
            throw new HttpError(400, 'INVALID_AI_TOOL_ARGUMENTS', 'Invalid AI tool arguments');
          }
          const result = await executeReadTool(
            actor.uid,
            toolCall.function.name,
            args,
            dependencies.readModel,
          );
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(result),
          });
        }
      }
      throw new HttpError(502, 'AI_TOOL_LIMIT_REACHED', 'AI tool limit reached');
    } catch (error) {
      const httpError = toHttpError(error);
      return res.status(httpError.status).json({ error: httpError.code, message: httpError.message });
    }
  };
}

export default createChatHandler();
