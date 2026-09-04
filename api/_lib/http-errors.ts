export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  return new HttpError(500, 'INTERNAL_ERROR', 'Unexpected server error');
}
