import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TrackingService } from './tracking.service.js';
import { UpdateLocationDto, GpsPingDto } from './dto/tracking.dto.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private readonly trackingService: TrackingService) {}

  afterInit() {
    this.logger.log('Tracking WebSocket Gateway initialized');

    // Kết nối callback phát sóng tự động từ TrackingService (kể cả khi nhận từ REST hay Simulator)
    this.trackingService.setBroadcastCallback((tripId, location, etas, alerts) => {
      if (!this.server) return;
      const room = `trip:${tripId}`;

      // 1. Phát sóng tọa độ mới nhất
      this.server.to(room).emit('passenger:bus-location', location);

      // 2. Phát sóng danh sách ETA các trạm
      this.server.to(room).emit('passenger:eta-update', {
        tripId,
        stationEtas: etas,
      });

      // 3. Phát sóng cảnh báo trạm nếu xe tiến vào geofence <= 500m
      if (alerts && alerts.length > 0) {
        for (const alert of alerts) {
          this.server.to(room).emit('passenger:station-alert', alert);
        }
      }
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from WebSocket: ${client.id}`);
  }

  @SubscribeMessage('join-trip')
  async handleJoinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tripId: string },
  ) {
    if (data?.tripId) {
      const room = `trip:${data.tripId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);

      // Gửi ngay lập tức snapshot dữ liệu mới nhất từ Cache về cho client vừa kết nối
      try {
        const liveSnapshot = await this.trackingService.getLiveTrackingWithEta(data.tripId);
        if (liveSnapshot) {
          client.emit('passenger:bus-location', {
            tripId: liveSnapshot.tripId,
            latitude: liveSnapshot.latitude,
            longitude: liveSnapshot.longitude,
            speedKmh: liveSnapshot.speedKmh,
            headingDegrees: liveSnapshot.headingDegrees,
            batteryPercent: liveSnapshot.batteryPercent,
            lastUpdated: liveSnapshot.lastUpdated,
            isSimulated: liveSnapshot.isSimulated,
          });

          client.emit('passenger:eta-update', {
            tripId: data.tripId,
            stationEtas: liveSnapshot.stationEtas,
          });
        }
      } catch (err: any) {
        this.logger.warn(`Could not send initial snapshot on join-trip: ${err.message}`);
      }

      return { event: 'joined', room };
    }
  }

  @SubscribeMessage('leave-trip')
  handleLeaveTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tripId: string },
  ) {
    if (data?.tripId) {
      const room = `trip:${data.tripId}`;
      client.leave(room);
      this.logger.log(`Client ${client.id} left room ${room}`);
      return { event: 'left', room };
    }
  }

  @SubscribeMessage('driver:update-location')
  async handleDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: UpdateLocationDto,
  ) {
    return this.processLocationUpdate(dto);
  }

  @SubscribeMessage('bus:gps-update')
  async handleBusGpsUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: GpsPingDto,
  ) {
    return this.processLocationUpdate(dto);
  }

  private async processLocationUpdate(dto: UpdateLocationDto | GpsPingDto) {
    try {
      const { tracking, stationAlerts, stationEtas } =
        await this.trackingService.recordLocation(dto);

      return {
        success: true,
        tripId: dto.tripId,
        stationAlertsCount: stationAlerts?.length || 0,
        stationEtasCount: stationEtas?.length || 0,
      };
    } catch (err: any) {
      this.logger.error(`Error processing driver location: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
