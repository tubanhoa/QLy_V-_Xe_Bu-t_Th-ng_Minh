'use client'

/**
 * Hook Quản lý Kết nối Thời gian thực 3 Tầng:
 *   - Tầng 1 (Ưu tiên): WebSocket (Socket.io) - Độ trễ < 5ms
 *   - Tầng 2 (Dự phòng di động/proxy): Server-Sent Events (SSE)
 *   - Tầng 3 (Dự phòng mất mạng): REST Polling (5s)
 * 
 * Domain: Tracking & Station ETA
 * Branch: feature/SBTS-frontend-realtime-tracking-and-eta
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { trackingService } from '@/lib/services/tracking.service'
import { haptic } from '@/lib/utils/haptics'
import type {
  LiveLocation,
  StationEtaItem,
  StationAlert,
  SimulatorStatus,
  TripIncident,
} from '@/lib/types/tracking'

export type ConnectionMode = 'websocket' | 'sse' | 'polling' | 'connecting' | 'disconnected'

export interface UseBusTrackingReturn {
  location: LiveLocation | null
  stationEtas: StationEtaItem[]
  stationAlert: StationAlert | null
  incidents: TripIncident[]
  activePendingIncident: TripIncident | null
  resolvedNotice: {
    incidentId: string
    resolutionNotes?: string
    resolvedAt?: string
  } | null
  simulatorStatus: SimulatorStatus | null
  connectionMode: ConnectionMode
  isConnected: boolean
  isLoading: boolean
  lastUpdated: Date | null
  clearStationAlert: () => void
  clearResolvedNotice: () => void
  refreshData: () => Promise<void>
  startSimulator: (multiplier?: number) => Promise<boolean>
  stopSimulator: () => Promise<boolean>
  isSimulating: boolean
}

export function useBusTracking(tripId: string): UseBusTrackingReturn {
  const [location, setLocation] = useState<LiveLocation | null>(null)
  const [stationEtas, setStationEtas] = useState<StationEtaItem[]>([])
  const [stationAlert, setStationAlert] = useState<StationAlert | null>(null)
  const [incidents, setIncidents] = useState<TripIncident[]>([])
  const [activePendingIncident, setActivePendingIncident] = useState<TripIncident | null>(null)
  const [resolvedNotice, setResolvedNotice] = useState<{
    incidentId: string
    resolutionNotes?: string
    resolvedAt?: string
  } | null>(null)
  const [simulatorStatus, setSimulatorStatus] = useState<SimulatorStatus | null>(null)
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('connecting')
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const sseRef = useRef<EventSource | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isComponentMounted = useRef(true)

  // 1. Snapshot khởi tạo và lấy sự cố từ REST
  const fetchInitialSnapshot = useCallback(async () => {
    try {
      const [liveRes, incRes, simRes] = await Promise.all([
        trackingService.getLiveTrackingWithEta(tripId),
        trackingService.getTripIncidents(tripId),
        trackingService.getSimulatorStatus(tripId),
      ])

      if (!isComponentMounted.current) return

      if (liveRes.success && liveRes.data) {
        setLocation(liveRes.data)
        if (liveRes.data.stationEtas && liveRes.data.stationEtas.length > 0) {
          setStationEtas(liveRes.data.stationEtas)
        }
        setLastUpdated(new Date(liveRes.data.lastUpdated || Date.now()))
      }

      if (incRes.success && incRes.data) {
        setIncidents(incRes.data)
        const pending = incRes.data.find(
          (i: TripIncident) =>
            i.resolutionStatus === 'pending' ||
            (!i.resolvedAt && i.resolutionStatus !== 'resolved'),
        )
        if (pending) {
          setActivePendingIncident(pending)
        } else {
          setActivePendingIncident(null)
        }
      }

      if (simRes.success && simRes.data) {
        setSimulatorStatus(simRes.data)
        setIsSimulating(!!simRes.data.isRunning)
      }
    } catch (err) {
      console.warn('[useBusTracking] Error fetching initial snapshot:', err)
    } finally {
      if (isComponentMounted.current) {
        setIsLoading(false)
      }
    }
  }, [tripId])

  // 2. Tầng 3: Polling Fallback
  const startPollingFallback = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    setConnectionMode('polling')
    setIsConnected(true)

    pollTimerRef.current = setInterval(async () => {
      if (!isComponentMounted.current) return
      try {
        const liveRes = await trackingService.getLiveTrackingWithEta(tripId)
        if (liveRes.success && liveRes.data && isComponentMounted.current) {
          setLocation(liveRes.data)
          if (liveRes.data.stationEtas) {
            setStationEtas(liveRes.data.stationEtas)
          }
          setLastUpdated(new Date(liveRes.data.lastUpdated || Date.now()))
          setIsConnected(true)
        }
      } catch {
        if (isComponentMounted.current) {
          setIsConnected(false)
        }
      }
    }, 5000)
  }, [tripId])

  // 3. Tầng 2: SSE Fallback
  const startSseFallback = useCallback(() => {
    try {
      if (sseRef.current) {
        sseRef.current.close()
      }

      const es = trackingService.createTrackingEventSource(tripId)
      sseRef.current = es

      es.onopen = () => {
        if (!isComponentMounted.current) return
        setConnectionMode('sse')
        setIsConnected(true)
      }

      es.onmessage = (event) => {
        if (!isComponentMounted.current) return
        try {
          const payload = JSON.parse(event.data)
          if (payload?.busLocation) {
            setLocation(payload.busLocation)
            setLastUpdated(new Date(payload.busLocation.lastUpdated || Date.now()))
          }
          if (payload?.stationEtas) {
            setStationEtas(payload.stationEtas)
          }
          setIsConnected(true)
        } catch (err) {
          console.error('[useBusTracking] SSE parse error:', err)
        }
      }

      es.onerror = () => {
        console.warn('[useBusTracking] SSE disconnected. Falling back to REST Polling.')
        if (sseRef.current) {
          sseRef.current.close()
          sseRef.current = null
        }
        if (isComponentMounted.current) {
          startPollingFallback()
        }
      }
    } catch {
      startPollingFallback()
    }
  }, [tripId, startPollingFallback])

  // 4. Tầng 1: Socket.io Primary Connection
  useEffect(() => {
    isComponentMounted.current = true
    fetchInitialSnapshot()

    const socketUrl = trackingService.getSocketUrl()
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnectionAttempts: 2,
      reconnectionDelay: 2000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      if (!isComponentMounted.current) return
      setConnectionMode('websocket')
      setIsConnected(true)
      socket.emit('join-trip', { tripId })
    })

    socket.on('passenger:bus-location', (data: LiveLocation) => {
      if (!isComponentMounted.current) return
      setLocation(data)
      setLastUpdated(new Date(data.lastUpdated || Date.now()))
      setIsConnected(true)
    })

    socket.on('passenger:eta-update', (data: { tripId: string; stationEtas: StationEtaItem[] }) => {
      if (!isComponentMounted.current) return
      if (data?.stationEtas) {
        setStationEtas(data.stationEtas)
      }
      setIsConnected(true)
    })

    socket.on('passenger:incident-alert', (data: any) => {
      if (!isComponentMounted.current) return
      const newIncident: TripIncident = {
        id: data.incidentId || data.id || `inc_${Date.now()}`,
        tripId: data.tripId || tripId,
        type: data.incidentType || data.type || 'other',
        incidentType: data.incidentType || data.type || 'other',
        severity: data.severity || 'medium',
        description: data.description || '',
        delayMinutesEstimate: data.delayMinutesEstimate,
        resolutionStatus: 'pending',
        reportedAt: data.reportedAt || new Date().toISOString(),
      }
      setIncidents((prev) => [newIncident, ...prev.filter((i) => i.id !== newIncident.id)])
      setActivePendingIncident(newIncident)
      setResolvedNotice(null)
      try {
        haptic.notification('warning')
      } catch {
        // ignore
      }
    })

    socket.on('passenger:incident-resolved', (data: any) => {
      if (!isComponentMounted.current) return
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === data.incidentId
            ? {
                ...i,
                resolutionStatus: 'resolved',
                resolvedAt: data.resolvedAt || new Date().toISOString(),
                resolutionNotes: data.resolutionNotes || i.resolutionNotes,
              }
            : i,
        ),
      )
      setActivePendingIncident(null)
      setResolvedNotice({
        incidentId: data.incidentId,
        resolutionNotes: data.resolutionNotes,
        resolvedAt: data.resolvedAt || new Date().toISOString(),
      })
      try {
        haptic.play('success')
      } catch {
        // ignore
      }
    })

    socket.on('passenger:station-alert', (alert: StationAlert) => {
      if (!isComponentMounted.current) return
      setStationAlert(alert)
    })

    socket.on('connect_error', () => {
      console.warn('[useBusTracking] Socket.io connect failed. Switching to SSE...')
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      if (isComponentMounted.current) {
        startSseFallback()
      }
    })

    return () => {
      isComponentMounted.current = false
      if (socketRef.current) {
        socketRef.current.emit('leave-trip', { tripId })
        socketRef.current.disconnect()
        socketRef.current = null
      }
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [tripId, fetchInitialSnapshot, startSseFallback])

  // Điều khiển Simulator
  const startSimulator = useCallback(
    async (multiplier: number = 1): Promise<boolean> => {
      const res = await trackingService.startSimulator(tripId, multiplier)
      if (res.success && res.data) {
        setSimulatorStatus(res.data)
        setIsSimulating(true)
        return true
      }
      return false
    },
    [tripId],
  )

  const stopSimulator = useCallback(async (): Promise<boolean> => {
    const res = await trackingService.stopSimulator(tripId)
    if (res.success) {
      setIsSimulating(false)
      setSimulatorStatus((prev) => (prev ? { ...prev, isRunning: false } : null))
      return true
    }
    return false
  }, [tripId])

  const clearStationAlert = useCallback(() => {
    setStationAlert(null)
  }, [])

  const clearResolvedNotice = useCallback(() => {
    setResolvedNotice(null)
  }, [])

  return {
    location,
    stationEtas,
    stationAlert,
    incidents,
    activePendingIncident,
    resolvedNotice,
    simulatorStatus,
    connectionMode,
    isConnected,
    isLoading,
    lastUpdated,
    clearStationAlert,
    clearResolvedNotice,
    refreshData: fetchInitialSnapshot,
    startSimulator,
    stopSimulator,
    isSimulating,
  }
}
