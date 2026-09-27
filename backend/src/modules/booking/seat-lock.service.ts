import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface MemoryLock {
  userId: string;
  expiresAt: number;
}

export interface SeatLockInfo {
  isLocked: boolean;
  userId?: string;
  expiresAt?: number;
}

@Injectable()
export class SeatLockService {
  private readonly logger = new Logger(SeatLockService.name);
  private redisClient: Redis | null = null;
  private readonly memoryStore = new Map<string, MemoryLock>();
  private isRedisConnected = false;

  constructor() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || undefined;

    try {
      this.redisClient = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });

      this.redisClient.connect().then(() => {
        this.isRedisConnected = true;
        this.logger.log('Redis connected successfully for Seat Locking.');
      }).catch(() => {
        this.isRedisConnected = false;
        this.logger.warn('Redis not available; falling back to in-memory seat lock storage.');
      });

      this.redisClient.on('error', () => {
        this.isRedisConnected = false;
      });
    } catch {
      this.isRedisConnected = false;
      this.logger.warn('Using in-memory seat lock storage.');
    }
  }

  private getKey(tripId: string, seatId: string): string {
    return `lock:trip:${tripId}:seat:${seatId}`;
  }

  private getTripPrefix(tripId: string): string {
    return `lock:trip:${tripId}:seat:`;
  }

  async holdSeats(
    tripId: string,
    seatIds: string[],
    userId: string,
    ttlSeconds = 600,
  ): Promise<{ success: boolean; lockedSeats: string[]; failedSeats: string[] }> {
    const lockedSeats: string[] = [];
    const failedSeats: string[] = [];
    const newlyLockedKeys: string[] = [];

    for (const seatId of seatIds) {
      const key = this.getKey(tripId, seatId);

      if (this.isRedisConnected && this.redisClient) {
        try {
          // SET key value EX ttl NX -> returns 'OK' if key was set, null otherwise
          const result = await this.redisClient.set(key, userId, 'EX', ttlSeconds, 'NX');
          if (result === 'OK') {
            lockedSeats.push(seatId);
            newlyLockedKeys.push(key);
          } else {
            // Check if current user is the existing lock holder (renew lock)
            const currentHolder = await this.redisClient.get(key);
            if (currentHolder === userId) {
              await this.redisClient.set(key, userId, 'EX', ttlSeconds);
              lockedSeats.push(seatId);
            } else {
              failedSeats.push(seatId);
            }
          }
        } catch {
          // Fallback to memory
          this.handleMemoryHold(key, seatId, userId, ttlSeconds, lockedSeats, failedSeats, newlyLockedKeys);
        }
      } else {
        this.handleMemoryHold(key, seatId, userId, ttlSeconds, lockedSeats, failedSeats, newlyLockedKeys);
      }
    }

    if (failedSeats.length > 0) {
      // Rollback only newly locked seats in this request if any seat failed
      await this.releaseSeats(tripId, lockedSeats, userId);
      return { success: false, lockedSeats: [], failedSeats };
    }

    return { success: true, lockedSeats, failedSeats: [] };
  }

  private handleMemoryHold(
    key: string,
    seatId: string,
    userId: string,
    ttlSeconds: number,
    lockedSeats: string[],
    failedSeats: string[],
    newlyLockedKeys: string[],
  ) {
    const lock = this.memoryStore.get(key);
    const now = Date.now();
    if (!lock || lock.expiresAt <= now) {
      this.memoryStore.set(key, { userId, expiresAt: now + ttlSeconds * 1000 });
      lockedSeats.push(seatId);
      newlyLockedKeys.push(key);
    } else if (lock.userId === userId) {
      // User is renewing their own lock
      this.memoryStore.set(key, { userId, expiresAt: now + ttlSeconds * 1000 });
      lockedSeats.push(seatId);
    } else {
      failedSeats.push(seatId);
    }
  }

  async releaseSeats(tripId: string, seatIds: string[], userId?: string): Promise<void> {
    for (const seatId of seatIds) {
      const key = this.getKey(tripId, seatId);

      if (this.isRedisConnected && this.redisClient) {
        try {
          if (userId) {
            const holder = await this.redisClient.get(key);
            if (holder === userId) {
              await this.redisClient.del(key);
            }
          } else {
            await this.redisClient.del(key);
          }
        } catch {
          this.releaseMemorySeat(key, userId);
        }
      } else {
        this.releaseMemorySeat(key, userId);
      }
    }
  }

  private releaseMemorySeat(key: string, userId?: string) {
    const lock = this.memoryStore.get(key);
    if (lock) {
      if (!userId || lock.userId === userId) {
        this.memoryStore.delete(key);
      }
    }
  }

  async isSeatLocked(tripId: string, seatId: string): Promise<SeatLockInfo> {
    const key = this.getKey(tripId, seatId);

    if (this.isRedisConnected && this.redisClient) {
      try {
        const holder = await this.redisClient.get(key);
        if (holder) {
          const pttl = await this.redisClient.pttl(key);
          const expiresAt = pttl > 0 ? Date.now() + pttl : Date.now();
          return { isLocked: true, userId: holder, expiresAt };
        }
        return { isLocked: false };
      } catch {
        // fallback
      }
    }

    const lock = this.memoryStore.get(key);
    if (!lock) return { isLocked: false };
    if (lock.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
      return { isLocked: false };
    }
    return { isLocked: true, userId: lock.userId, expiresAt: lock.expiresAt };
  }

  async getLockedSeatsForTrip(tripId: string): Promise<Map<string, { userId: string; expiresAt: number }>> {
    const result = new Map<string, { userId: string; expiresAt: number }>();
    const prefix = this.getTripPrefix(tripId);

    if (this.isRedisConnected && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(`${prefix}*`);
        for (const key of keys) {
          const seatId = key.replace(prefix, '');
          const userId = await this.redisClient.get(key);
          if (userId) {
            const pttl = await this.redisClient.pttl(key);
            const expiresAt = pttl > 0 ? Date.now() + pttl : Date.now();
            result.set(seatId, { userId, expiresAt });
          }
        }
        return result;
      } catch {
        // fallback to memoryStore
      }
    }

    const now = Date.now();
    for (const [key, lock] of this.memoryStore.entries()) {
      if (key.startsWith(prefix)) {
        if (lock.expiresAt <= now) {
          this.memoryStore.delete(key);
        } else {
          const seatId = key.replace(prefix, '');
          result.set(seatId, { userId: lock.userId, expiresAt: lock.expiresAt });
        }
      }
    }

    return result;
  }
}

