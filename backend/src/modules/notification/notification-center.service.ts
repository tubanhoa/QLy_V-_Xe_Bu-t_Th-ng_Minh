import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity, NotificationType } from '../../database/entities/notification.entity.js';
import { NotificationPreferenceEntity } from '../../database/entities/notification-preference.entity.js';

export interface UserNotificationRecord {
  id: string;
  userId: string;
  tripId?: string;
  stationId?: string;
  type: string;
  title: string;
  message: string;
  deepLink?: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

export interface UserNotificationPreference {
  userId: string;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
}

@Injectable()
export class NotificationCenterService {
  private readonly logger = new Logger(NotificationCenterService.name);

  // In-memory backing for test harnesses & instant local lookups
  private notifications: UserNotificationRecord[] = [];
  private preferences = new Map<string, UserNotificationPreference>();

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository?: Repository<NotificationEntity>,
    @InjectRepository(NotificationPreferenceEntity)
    private readonly preferenceRepository?: Repository<NotificationPreferenceEntity>,
  ) {}

  /**
   * Tạo và lưu thông báo mới (In-app + DB)
   */
  public async saveNotification(record: {
    userId: string;
    tripId?: string;
    stationId?: string;
    type: string;
    title: string;
    message?: string;
    body?: string;
    deepLink?: string;
    data?: Record<string, any>;
  }): Promise<UserNotificationRecord> {
    const textBody = record.message || record.body || '';
    const deepLinkUrl =
      record.deepLink ||
      (record.tripId ? `/trips/${record.tripId}/live?focusStation=${record.stationId || ''}` : '');

    const recordData = {
      ...(record.data || {}),
      ...(deepLinkUrl ? { deepLink: deepLinkUrl } : {}),
    };

    // 1. In-memory record
    const memoryRecord: UserNotificationRecord = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: record.userId,
      tripId: record.tripId,
      stationId: record.stationId,
      type: record.type,
      title: record.title,
      message: textBody,
      deepLink: deepLinkUrl,
      data: recordData,
      isRead: false,
      createdAt: new Date(),
    };
    this.notifications.unshift(memoryRecord);

    // 2. Database record
    if (this.notificationRepository) {
      try {
        const entity = this.notificationRepository.create({
          userId: record.userId,
          tripId: record.tripId,
          stationId: record.stationId,
          type: record.type as NotificationType,
          title: record.title,
          body: textBody,
          data: recordData,
          isRead: false,
          deliveryStatus: 'SENT',
        });
        const saved = await this.notificationRepository.save(entity);
        memoryRecord.id = saved.id;
        memoryRecord.createdAt = saved.createdAt;
      } catch (err: any) {
        this.logger.warn(`Could not save notification entity to DB: ${err.message}`);
      }
    }

    return memoryRecord;
  }

  /**
   * Lấy danh sách lịch sử thông báo của người dùng kèm phân trang
   */
  public async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ): Promise<{
    notifications: UserNotificationRecord[];
    total: number;
    unreadCount: number;
    page?: number;
    limit?: number;
  }> {
    // 1. Try DB first
    if (this.notificationRepository) {
      try {
        const query = this.notificationRepository
          .createQueryBuilder('n')
          .where('n.userId = :userId', { userId });

        if (unreadOnly) {
          query.andWhere('n.isRead = :isRead', { isRead: false });
        }

        query.orderBy('n.createdAt', 'DESC');
        query.skip((page - 1) * limit).take(limit);

        const [entities, total] = await query.getManyAndCount();
        const unreadCount = await this.notificationRepository.count({
          where: { userId, isRead: false },
        });

        const records: UserNotificationRecord[] = entities.map((e) => ({
          id: e.id,
          userId: e.userId,
          tripId: e.tripId,
          stationId: e.stationId,
          type: e.type,
          title: e.title,
          message: e.body,
          deepLink: e.data?.deepLink || '',
          data: e.data,
          isRead: e.isRead,
          createdAt: e.createdAt,
        }));

        return {
          notifications: records,
          total,
          unreadCount,
          page,
          limit,
        };
      } catch {
        // Fallback to memory
      }
    }

    // 2. Memory Fallback
    let userList = this.notifications.filter((n) => n.userId === userId);
    const unreadCount = userList.filter((n) => !n.isRead).length;

    if (unreadOnly) {
      userList = userList.filter((n) => !n.isRead);
    }

    const total = userList.length;
    const startIndex = (page - 1) * limit;
    const paginated = userList.slice(startIndex, startIndex + limit);

    return {
      notifications: paginated,
      total,
      unreadCount,
      page,
      limit,
    };
  }

  /**
   * Đếm số lượng thông báo chưa đọc
   */
  public async getUnreadCount(userId: string): Promise<number> {
    if (this.notificationRepository) {
      try {
        return await this.notificationRepository.count({
          where: { userId, isRead: false },
        });
      } catch {
        // Fallback
      }
    }
    return this.notifications.filter((n) => n.userId === userId && !n.isRead).length;
  }

  /**
   * Đánh dấu 1 thông báo là đã đọc
   */
  public async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    // 1. Update in-memory
    const memoryItem = this.notifications.find((n) => n.id === notificationId && n.userId === userId);
    if (memoryItem) {
      memoryItem.isRead = true;
    }

    // 2. Update DB
    if (this.notificationRepository) {
      try {
        const updateResult = await this.notificationRepository.update(
          { id: notificationId, userId },
          { isRead: true, readAt: new Date() },
        );
        return (updateResult.affected || 0) > 0 || !!memoryItem;
      } catch {
        // Fallback
      }
    }

    return !!memoryItem;
  }

  /**
   * Đánh dấu tất cả thông báo của người dùng là đã đọc
   */
  public async markAllAsRead(userId: string): Promise<number> {
    // In-memory update
    this.notifications.forEach((n) => {
      if (n.userId === userId) {
        n.isRead = true;
      }
    });

    if (this.notificationRepository) {
      try {
        const res = await this.notificationRepository.update(
          { userId, isRead: false },
          { isRead: true, readAt: new Date() },
        );
        return res.affected || 0;
      } catch {
        // Fallback
      }
    }

    return this.notifications.filter((n) => n.userId === userId).length;
  }

  /**
   * Cập nhật cài đặt nhận thông báo của người dùng
   */
  public async setPreferences(pref: {
    userId: string;
    pushEnabled?: boolean;
    smsEnabled?: boolean;
    emailEnabled?: boolean;
  }): Promise<UserNotificationPreference> {
    const existing = await this.getPreferences(pref.userId);
    const updated: UserNotificationPreference = {
      userId: pref.userId,
      pushEnabled: pref.pushEnabled !== undefined ? pref.pushEnabled : existing.pushEnabled,
      smsEnabled: pref.smsEnabled !== undefined ? pref.smsEnabled : existing.smsEnabled,
      emailEnabled: pref.emailEnabled !== undefined ? pref.emailEnabled : existing.emailEnabled,
    };

    // 1. In-memory
    this.preferences.set(pref.userId, updated);

    // 2. DB update
    if (this.preferenceRepository) {
      try {
        let dbPref = await this.preferenceRepository.findOne({ where: { userId: pref.userId } });
        if (dbPref) {
          dbPref.pushEnabled = updated.pushEnabled;
          dbPref.smsEnabled = updated.smsEnabled;
          dbPref.emailEnabled = updated.emailEnabled;
          await this.preferenceRepository.save(dbPref);
        } else {
          dbPref = this.preferenceRepository.create(updated);
          await this.preferenceRepository.save(dbPref);
        }
      } catch (err: any) {
        this.logger.warn(`Could not save notification preferences to DB: ${err.message}`);
      }
    }

    return updated;
  }

  /**
   * Lấy cài đặt thông báo của người dùng (Mặc định: push=true, sms=false, email=true)
   */
  public async getPreferences(userId: string): Promise<UserNotificationPreference> {
    // 1. Try DB
    if (this.preferenceRepository) {
      try {
        const dbPref = await this.preferenceRepository.findOne({ where: { userId } });
        if (dbPref) {
          const res: UserNotificationPreference = {
            userId: dbPref.userId,
            pushEnabled: dbPref.pushEnabled,
            smsEnabled: dbPref.smsEnabled,
            emailEnabled: dbPref.emailEnabled,
          };
          this.preferences.set(userId, res);
          return res;
        }
      } catch {
        // Fallback
      }
    }

    // 2. Memory / Default
    return (
      this.preferences.get(userId) || {
        userId,
        pushEnabled: true,
        smsEnabled: false,
        emailEnabled: true,
      }
    );
  }
}
