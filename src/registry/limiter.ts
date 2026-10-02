/** Runs at most `limit` tasks at a time; the rest wait in arrival order. */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Concurrency must be a positive integer.');
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await task();
    } finally {
      // Hand the slot straight to the next waiter, or free it.
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}
