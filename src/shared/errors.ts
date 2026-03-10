export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  constructor(message: string, statusCode?: number) {
    super(message, 'AUTH_ERROR', statusCode, false);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super(message, 'RATE_LIMIT', 429, true);
    this.name = 'RateLimitError';
  }
}

export class ApiError extends AppError {
  constructor(message: string, statusCode: number, retryable: boolean = false) {
    super(message, 'API_ERROR', statusCode, retryable);
    this.name = 'ApiError';
  }
}
