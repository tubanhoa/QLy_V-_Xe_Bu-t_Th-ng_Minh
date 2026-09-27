import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TrackingService } from './tracking.service.js';
import { UpdateLocationDto } from './dto/tracking.dto.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private readonly trackingService: TrackingService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from WebSocket: ${client.id}`);
  }

  @SubscribeMessage('join-trip')
  handleJoinTrip(@ConnectedSocket() client: Socket, @MessageBody() data: { tripId: string }) {
    if (data?.tripId) {
      const room = `trip:${data.tripId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { event: 'joined', room };
    }
  }

  @SubscribeMessage('leave-trip')
  handleLeaveTrip(@ConnectedSocket() client: Socket, @MessageBody() data: { tripId: string }) {
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
    try {
      const { tracking, stationAlerts } = await this.trackingService.recordLocation(dto);
      const room = `trip:${dto.tripId}`;

      // Broadcast location to all passengers watching this trip
      this.server.to(room).emit('passenger:bus-location', {
        tripId: dto.tripId,
        latitude: Number(dto.latitude),
        longitude: Number(dto.longitude),
        speedKmh: dto.speedKmh || 0,
        headingDegrees: dto.headingDegrees || 0,
        batteryPercent: dto.batteryPercent || 100,
        lastUpdated: tracking.lastUpdated,
      });

      // If approaching any station (< 500m), send geofence alert
      if (stationAlerts && stationAlerts.length > 0) {
        for (const alert of stationAlerts) {
          this.server.to(room).emit('passenger:station-alert', alert);
        }
      }

      return { success: true };
    } catch (err: any) {
      this.logger.error(`Error processing driver location: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
