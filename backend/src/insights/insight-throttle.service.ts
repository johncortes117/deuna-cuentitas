import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class InsightThrottleService {
  constructor(private readonly redis: RedisService) {}

  async isThrottled(commerceId: string, ruleId: string): Promise<boolean> {
    try {
      return await this.redis.exists(this.key(commerceId, ruleId));
    } catch {
      // If Redis is unavailable, assume not throttled so insights can still fire
      return false;
    }
  }

  async setThrottle(commerceId: string, ruleId: string, cooldownHours: number): Promise<void> {
    try {
      await this.redis.set(this.key(commerceId, ruleId), '1', cooldownHours * 3600);
    } catch {
      // Non-critical: worst case the same insight fires again before cooldown
    }
  }

  /** Clears a throttle — useful for testing or admin resets. */
  async clearThrottle(commerceId: string, ruleId: string): Promise<void> {
    try {
      await this.redis.del(this.key(commerceId, ruleId));
    } catch {
      // ignore
    }
  }

  private key(commerceId: string, ruleId: string): string {
    return `insight:throttle:${commerceId}:${ruleId}`;
  }
}
