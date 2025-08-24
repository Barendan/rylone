// Rate Limiter for Yelp API - handles 50 req/sec and 5,000/day limits
export class RateLimiter {
  private dailyCalls: number = 0;
  private lastReset: number = Date.now();
  private perSecondCalls: number = 0;
  private lastSecondReset: number = Date.now();
  private requestQueue: Array<() => void> = [];
  private isProcessing: boolean = false;

  constructor(
    private maxPerSecond: number = 50,
    private maxPerDay: number = 5000
  ) {
    // Reset daily counter every 24 hours
    setInterval(() => this.resetDailyCounter(), 24 * 60 * 60 * 1000);
    
    // Reset per-second counter every second
    setInterval(() => this.resetPerSecondCounter(), 1000);
  }

  private resetDailyCounter(): void {
    this.dailyCalls = 0;
    this.lastReset = Date.now();
    console.log(`🔄 Daily API quota reset. New day starts at ${new Date().toISOString()}`);
  }

  private resetPerSecondCounter(): void {
    this.perSecondCalls = 0;
    this.lastSecondReset = Date.now();
  }

  private canMakeRequest(): boolean {
    const now = Date.now();
    
    // Check daily limit
    if (this.dailyCalls >= this.maxPerDay) {
      console.log(`⚠️ Daily API quota reached (${this.dailyCalls}/${this.maxPerDay})`);
      return false;
    }
    
    // Check per-second limit
    if (this.perSecondCalls >= this.maxPerSecond) {
      return false;
    }
    
    return true;
  }

  async waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      if (this.canMakeRequest()) {
        this.makeRequest();
        resolve();
      } else {
        // Add to queue and process when possible
        this.requestQueue.push(() => {
          this.makeRequest();
          resolve();
        });
        this.processQueue();
      }
    });
  }

  private makeRequest(): void {
    this.dailyCalls++;
    this.perSecondCalls++;
    console.log(`📡 API call made. Daily: ${this.dailyCalls}/${this.maxPerDay}, Per-second: ${this.perSecondCalls}/${this.maxPerSecond}`);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    while (this.requestQueue.length > 0 && this.canMakeRequest()) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        nextRequest();
        // Small delay to ensure rate limits are respected
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
    
    this.isProcessing = false;
    
    // If queue still has items, schedule next processing
    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  getQuotaStatus(): { dailyUsed: number; dailyRemaining: number; perSecondUsed: number; perSecondRemaining: number } {
    return {
      dailyUsed: this.dailyCalls,
      dailyRemaining: this.maxPerDay - this.dailyCalls,
      perSecondUsed: this.perSecondCalls,
      perSecondRemaining: this.maxPerSecond - this.perSecondCalls
    };
  }

  getDailyUsagePercentage(): number {
    return (this.dailyCalls / this.maxPerDay) * 100;
  }

  resetDailyQuota(): void {
    this.dailyCalls = 0;
    this.lastReset = Date.now();
    console.log(`🔄 Daily quota manually reset`);
  }
}

// Global rate limiter instance
export const yelpRateLimiter = new RateLimiter(50, 5000);
