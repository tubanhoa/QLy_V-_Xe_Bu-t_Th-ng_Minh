import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

interface MemoryLock {
  userId: string;
  expiresAt: number;
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

  async holdSeats(
    tripId: string,
    seatIds: string[],
    userId: string,
    ttlSeconds = 600,
  ): Promise<{ success: boolean; lockedSeats: string[]; failedSeats: string[] }> {
    const lockedSeats: string[] = [];
    const failedSeats: string[] = [];

    for (const seatId of seatIds) {
      const key = this.getKey(tripId, seatId);

      if (this.isRedisConnected && this.redisClient) {
        try {
          // SET key value EX ttl NX -> returns 'OK' if key was set, null otherwise
          const result = await this.redisClient.set(key, userId, 'EX', ttlSeconds, 'NX');
          if (result === 'OK') {
            lockedSeats.push(seatId);
          } else {
            failedSeats.push(seatId);
          }
        } catch {
          // Fallback to memory
          const lock = this.memoryStore.get(key);
          const now = Date.now();
          if (!lock || lock.expiresAt <= now) {
            this.memoryStore.set(key, { userId, expiresAt: now + ttlSeconds * 1000 });
            lockedSeats.push(seatId);
          } else {
            failedSeats.push(seatId);
          }
        }
      } else {
        const key = this.getKey(tripId, seatId);
        const lock = this.memoryStore.get(key);
        const now = Date.now();
        if (!lock || lock.expiresAt <= now) {
          this.memoryStore.set(key, { userId, expiresAt: now + ttlSeconds * 1000 });
          lockedSeats.push(seatId);
        } else {
          failedSeats.push(seatId);
        }
      }
    }

    if (failedSeats.length > 0) {
      // Rollback newly locked seats if any seat failed
      await this.releaseSeats(tripId, lockedSeats, userId);
      return { success: false, lockedSeats: [], failedSeats };
    }

    return { success: true, lockedSeats, failedSeats: [] };
  }

  async releaseSeats(tripId: string, seatIds: string[], userId: string): Promise<void> {
    for (const seatId of seatIds) {
      const key = this.getKey(tripId, seatId);

      if (this.isRedisConnected && this.redisClient) {
        try {
          const holder = await this.redisClient.get(key);
          if (holder === userId) {
            await this.redisClient.del(key);
          }
        } catch {
          this.memoryStore.delete(key);
        }
      } else {
        const lock = this.memoryStore.get(key);
        if (lock && lock.userId === userId) {
          this.memoryStore.delete(key);
        }
      }
    }
  }

  async isSeatLocked(tripId: string, seatId: string): Promise<boolean> {
    const key = this.getKey(tripId, seatId);

    if (this.isRedisConnected && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        return !!val;
      } catch {
        // fallback
      }
    }

    const lock = this.memoryStore.get(key);
    if (!lock) return false;
    if (lock.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
      return false;
    }
    return true;
  }
}
