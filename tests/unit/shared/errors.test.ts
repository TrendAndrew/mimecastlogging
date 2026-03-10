import { AppError, AuthError, RateLimitError, ApiError } from '../../../src/shared/errors';

describe('Error classes', () => {
  it('AppError should have correct properties', () => {
    const err = new AppError('test', 'TEST_CODE', 500, true);
    expect(err.message).toBe('test');
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(500);
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('AppError');
    expect(err instanceof Error).toBe(true);
  });

  it('AuthError should set correct defaults', () => {
    const err = new AuthError('auth failed', 401);
    expect(err.code).toBe('AUTH_ERROR');
    expect(err.statusCode).toBe(401);
    expect(err.retryable).toBe(false);
    expect(err.name).toBe('AuthError');
    expect(err instanceof AppError).toBe(true);
  });

  it('RateLimitError should include retryAfterMs', () => {
    const err = new RateLimitError('too many requests', 5000);
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.statusCode).toBe(429);
    expect(err.retryable).toBe(true);
    expect(err.retryAfterMs).toBe(5000);
    expect(err.name).toBe('RateLimitError');
  });

  it('ApiError should set retryable flag', () => {
    const retryable = new ApiError('server error', 503, true);
    expect(retryable.retryable).toBe(true);

    const notRetryable = new ApiError('bad request', 400);
    expect(notRetryable.retryable).toBe(false);
    expect(notRetryable.name).toBe('ApiError');
  });
});
