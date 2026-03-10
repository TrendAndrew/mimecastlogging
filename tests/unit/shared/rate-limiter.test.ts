import { RateLimiter } from '../../../src/shared/rate-limiter';

describe('RateLimiter', () => {
  it('should allow requests under the limit', () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60000 });
    expect(limiter.canProceed()).toBe(true);
    expect(limiter.remaining()).toBe(3);
  });

  it('should block when limit is reached', () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60000 });
    limiter.record();
    limiter.record();
    expect(limiter.canProceed()).toBe(false);
    expect(limiter.remaining()).toBe(0);
  });

  it('should use defaults when no options provided', () => {
    const limiter = new RateLimiter();
    expect(limiter.remaining()).toBe(300);
  });

  it('should waitForSlot when at capacity', async () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 50 });
    limiter.record();

    const start = Date.now();
    await limiter.waitForSlot();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(limiter.canProceed()).toBe(true);
  });

  it('should resolve immediately if slot available', async () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
    const start = Date.now();
    await limiter.waitForSlot();
    expect(Date.now() - start).toBeLessThan(50);
  });
});
