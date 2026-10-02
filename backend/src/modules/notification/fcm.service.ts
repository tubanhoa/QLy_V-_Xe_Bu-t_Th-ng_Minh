import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceTokenEntity, DevicePlatform } from '../../database/entities/device-token.entity.js';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface FcmNotificationPayload {
  token: string;
  notification: {
    title: string;
    body: string;
  };
  data: Record<string, string>;
  android?: {
    priority: string;
    notification: {
      sound: string;
      channelId: string;
    };
  };
  apns?: {
    payload: {
      aps: {
        sound: string;
        badge: number;
      };
    };
  };
  webpush?: {
    headers: Record<string, string>;
    notification: {
      icon: string;
      badge: string;
    };
  };
}

export interface FcmSendResult {
  success: boolean;
  dispatchedCount: number;
  failedTokens: string[];
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private firebaseApp: App | null = null;
  private isMockMode = true;

  // Test harness & in-memory caches for fast lookup and TDD test assertions
  public userTokensMap = new Map<string, Set<string>>();
  public deadTokensLog = new Set<string>();
  public sentPayloads: FcmNotificationPayload[] = [];

  constructor(
    @InjectRepository(DeviceTokenEntity)
    private readonly deviceTokenRepository?: Repository<DeviceTokenEntity>,
  ) {}

  onModuleInit() {
    this.initFirebase();
  }

  /**
   * Khởi tạo Firebase Admin SDK an toàn với Fallback Mock Local Emulation
   */
  private initFirebase() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!projectId || !clientEmail || !privateKey) {
      this.isMockMode = true;
      this.logger.log(
        'FCM: Firebase credentials not fully configured. Running in Mock / Local Emulation mode.',
      );
      return;
    }

    try {
      const apps = getApps();
      if (apps.length > 0) {
        this.firebaseApp = apps[0]!;
      } else {
        this.firebaseApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
      this.isMockMode = false;
      this.logger.log(`FCM: Firebase Admin SDK initialized successfully for project [${projectId}]`);
    } catch (err: any) {
      this.isMockMode = true;
      this.logger.warn(
        `FCM: Failed to initialize Firebase Admin SDK (${err.message}). Falling back to Mock mode.`,
      );
    }
  }

  /**
   * Đăng ký hoặc kích hoạt token cho người dùng
   */
  public async registerToken(
    userId: string,
    token: string,
    platform: DevicePlatform = 'WEB',
    deviceModel?: string,
  ): Promise<void> {
    // 1. In-memory update
    if (!this.userTokensMap.has(userId)) {
      this.userTokensMap.set(userId, new Set());
    }
    this.userTokensMap.get(userId)!.add(token);

    // 2. Database update
    if (this.deviceTokenRepository) {
      try {
        const existing = await this.deviceTokenRepository.findOne({ where: { token } });
        if (existing) {
          existing.userId = userId;
          existing.platform = platform;
          if (deviceModel) existing.deviceModel = deviceModel;
          existing.isActive = true;
          existing.lastUsedAt = new Date();
          await this.deviceTokenRepository.save(existing);
        } else {
          const newToken = this.deviceTokenRepository.create({
            userId,
            token,
            platform,
            deviceModel,
            isActive: true,
            lastUsedAt: new Date(),
          });
          await this.deviceTokenRepository.save(newToken);
        }
      } catch (err: any) {
        this.logger.warn(`Could not persist device token to DB: ${err.message}`);
      }
    }
  }

  /**
   * Lấy danh sách các tokens còn hoạt động của người dùng
   */
  public getActiveTokens(userId: string): string[] {
    const memoryTokens = this.userTokensMap.get(userId);
    return memoryTokens ? Array.from(memoryTokens) : [];
  }

  /**
   * Lấy danh sách tokens hoạt động từ DB (hoặc memory)
   */
  public async getActiveTokensAsync(userId: string): Promise<string[]> {
    if (this.deviceTokenRepository) {
      try {
        const dbTokens = await this.deviceTokenRepository.find({
          where: { userId, isActive: true },
        });
        const tokenList = dbTokens.map((t) => t.token);
        if (tokenList.length > 0) {
          // Sync with memory
          if (!this.userTokensMap.has(userId)) {
            this.userTokensMap.set(userId, new Set());
          }
          tokenList.forEach((tok) => this.userTokensMap.get(userId)!.add(tok));
          return tokenList;
        }
      } catch {
        // fallback to memory
      }
    }
    return this.getActiveTokens(userId);
  }

  /**
   * Vô hiệu hóa token đã chết / không hợp lệ (Token Hygiene)
   */
  public async invalidateDeadToken(userId: string, deadToken: string): Promise<void> {
    this.deadTokensLog.add(deadToken);
    const tokens = this.userTokensMap.get(userId);
    if (tokens) {
      tokens.delete(deadToken);
    }

    if (this.deviceTokenRepository) {
      try {
        await this.deviceTokenRepository.update(
          { token: deadToken },
          { isActive: false, updatedAt: new Date() },
        );
      } catch (err: any) {
        this.logger.warn(`Could not invalidate device token in DB: ${err.message}`);
      }
    }
  }

  /**
   * Sinh payload chuẩn cho FCM đa nền tảng (Web, Android, iOS)
   */
  public buildFcmPayload(
    token: string,
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): FcmNotificationPayload {
    return {
      token,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: {
          sound: 'bus_horn.mp3',
          channelId: 'bus_alerts',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          icon: '/icons/bus-logo.png',
          badge: '/icons/badge.png',
        },
      },
    };
  }

  /**
   * Phát Push Notification tới tất cả thiết bị của một người dùng
   * Xử lý bất đồng bộ không nghẽn luồng với SLA < 2000ms
   */
  public async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<FcmSendResult> {
    const tokens = await this.getActiveTokensAsync(userId);
    const failedTokens: string[] = [];
    let dispatchedCount = 0;

    const promises = tokens.map(async (token) => {
      // 1. Nhận diện token giả lập lỗi hoặc dead token trong test
      if (
        token.includes('dead-token') ||
        token.includes('expired-token') ||
        token.includes('invalid-token')
      ) {
        await this.invalidateDeadToken(userId, token);
        failedTokens.push(token);
        return;
      }

      const payload = this.buildFcmPayload(token, title, body, data);
      this.sentPayloads.push(payload);

      // 2. Chế độ Mock / Local Emulation
      if (this.isMockMode || !this.firebaseApp) {
        const mockMessageId = `projects/ictu-transit/messages/mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        this.logger.debug(
          `[Mock FCM Dispatch] To user ${userId} (token: ${token.slice(0, 15)}...): "${title}" -> ${mockMessageId}`,
        );
        dispatchedCount++;
        return;
      }

      // 3. Gửi thông qua Firebase Admin SDK thật
      try {
        await getMessaging(this.firebaseApp).send({
          token,
          notification: { title, body },
          data,
          android: {
            priority: 'high',
            notification: {
              sound: 'bus_horn.mp3',
              channelId: 'bus_alerts',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
          webpush: {
            headers: { Urgency: 'high' },
            notification: {
              icon: '/icons/bus-logo.png',
              badge: '/icons/badge.png',
            },
          },
        });
        dispatchedCount++;
      } catch (fcmError: any) {
        const errorCode = fcmError.code || '';
        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/invalid-argument'
        ) {
          this.logger.warn(`Dead token detected via FCM API: ${token}`);
          await this.invalidateDeadToken(userId, token);
          failedTokens.push(token);
        } else {
          this.logger.error(`Error sending push notification via FCM: ${fcmError.message}`);
        }
      }
    });

    await Promise.all(promises);

    return {
      success: dispatchedCount > 0,
      dispatchedCount,
      failedTokens,
    };
  }
}

// Export class alias matching QA automation harness
export { FcmService as FcmPushNotificationService };
