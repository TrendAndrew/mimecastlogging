export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: RateLimiterOptions = { maxRequests: 300, windowMs: 3600000 }) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }

  canProceed(): boolean {
    this.prune();
    return this.timestamps.length < this.maxRequests;
  }

  remaining(): number {
    this.prune();
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }

  record(): void {
    this.timestamps.push(Date.now());
  }

  async waitForSlot(): Promise<void> {
    while (!this.canProceed()) {
      const oldestInWindow = this.timestamps[0];
      const waitMs = oldestInWindow + this.windowMs - Date.now() + 100;
      await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 100)));
      this.prune();
    }
  }
}
