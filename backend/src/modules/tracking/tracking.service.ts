import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleTrackingEntity } from '../../database/entities/vehicle-tracking.entity.js';
import { TripIncidentEntity } from '../../database/entities/trip-incident.entity.js';
import { TripEntity } from '../../database/entities/trip.entity.js';
import { RouteStationEntity } from '../../database/entities/route-station.entity.js';
import { UpdateLocationDto, ReportIncidentDto } from './dto/tracking.dto.js';
import { IncidentSeverity } from '../../common/constants/status.constant.js';

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(VehicleTrackingEntity)
    private readonly trackingRepository: Repository<VehicleTrackingEntity>,
    @InjectRepository(TripIncidentEntity)
    private readonly incidentRepository: Repository<TripIncidentEntity>,
    @InjectRepository(TripEntity)
    private readonly tripRepository: Repository<TripEntity>,
    @InjectRepository(RouteStationEntity)
    private readonly routeStationRepository: Repository<RouteStationEntity>,
  ) {}

  async recordLocation(dto: UpdateLocationDto) {
    const tracking = this.trackingRepository.create({
      tripId: dto.tripId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speedKmh: dto.speedKmh,
      headingDegrees: dto.headingDegrees,
      batteryPercent: dto.batteryPercent,
    });

    const saved = await this.trackingRepository.save(tracking);

    // Calculate geofence proximity to upcoming stations
    const alerts = await this.checkStationAlerts(dto.tripId, dto.latitude, dto.longitude);

    return {
      tracking: saved,
      stationAlerts: alerts,
    };
  }

  async getLatestLocation(tripId: string) {
    const latest = await this.trackingRepository.findOne({
      where: { tripId },
      order: { lastUpdated: 'DESC' },
    });

    if (!latest) {
      // Return default location at ICTU if no tracking yet
      return {
        tripId,
        latitude: 21.585284,
        longitude: 105.806297,
        speedKmh: 0,
        headingDegrees: 0,
        batteryPercent: 100,
        lastUpdated: new Date(),
        isSimulated: true,
      };
    }

    return latest;
  }

  async checkStationAlerts(tripId: string, currentLat: number, currentLng: number) {
    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: { route: true },
    });

    if (!trip || !trip.routeId) return [];

    const routeStations = await this.routeStationRepository.find({
      where: { routeId: trip.routeId },
      relations: { station: true },
      order: { stopOrder: 'ASC' },
    });

    const alerts: Array<{
      stationId: string;
      stationName: string;
      distanceMeters: number;
      message: string;
    }> = [];

    const ALERT_RADIUS_METERS = parseInt(process.env.STATION_ALERT_RADIUS_METERS || '500', 10);

    for (const rs of routeStations) {
      if (!rs.station) continue;

      const dist = this.haversineDistance(
        currentLat,
        currentLng,
        Number(rs.station.latitude),
        Number(rs.station.longitude),
      );

      if (dist <= ALERT_RADIUS_METERS) {
        alerts.push({
          stationId: rs.station.id,
          stationName: rs.station.name,
          distanceMeters: Math.round(dist),
          message: `Xe buýt sắp đến trạm ${rs.station.name} (còn khoảng ${Math.round(dist)}m)`,
        });
      }
    }

    return alerts;
  }

  async reportIncident(dto: ReportIncidentDto, reportedBy: string) {
    const trip = await this.tripRepository.findOne({ where: { id: dto.tripId } });
    if (!trip) {
      throw new NotFoundException('Không tìm thấy chuyến xe');
    }

    const incident = this.incidentRepository.create({
      tripId: dto.tripId,
      reportedBy,
      incidentType: dto.incidentType,
      severity: dto.severity || IncidentSeverity.MEDIUM,
      description: dto.description,
      delayMinutesEstimate: dto.delayMinutesEstimate,
      resolutionStatus: 'pending',
    });

    return this.incidentRepository.save(incident);
  }

  async getTripIncidents(tripId: string) {
    return this.incidentRepository.find({
      where: { tripId },
      order: { reportedAt: 'DESC' },
    });
  }

  /**
   * Calculates Haversine distance in meters between two lat/lng points
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
