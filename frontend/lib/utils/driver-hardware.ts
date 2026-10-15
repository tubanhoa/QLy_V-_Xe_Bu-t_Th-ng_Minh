/**
 * Tiện ích phần cứng và âm thanh buồng lái tài xế (Driver Hardware & Transit Audio Engine)
 * - Screen Wake Lock API: Giữ màn hình táp-lô luôn sáng, không bị sleep khi đang lái xe
 * - Fullscreen Kiosk API: Bật chế độ buồng lái toàn màn hình không viền
 * - Web Audio Transit Chimes: Chuông xe buýt 100% Native Web Audio, độ trễ 0ms
 * - GPS Broadcaster: Tự động truyền tọa độ GPS thật từ thiết bị buồng lái lên máy chủ
 */

type SoundCue = 'stationArrival' | 'ticketSuccess' | 'ticketDuplicate' | 'ticketInvalid' | 'tripStart' | 'tripEnd' | 'tap'

class DriverHardwareEngine {
  private wakeLock: any = null
  private audioCtx: AudioContext | null = null
  private gpsWatchId: number | null = null
  private isBroadcastingGps: boolean = false

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass()
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {})
    }
    return this.audioCtx
  }

  /** 1. GIỮ MÀN HÌNH LUÔN SÁNG (Screen Wake Lock API) */
  public async requestWakeLock(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen')
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null
        })
        return true
      } catch (err) {
        console.warn('[DriverHardware] Không thể kích hoạt Screen Wake Lock:', err)
        return false
      }
    }
    return false
  }

  public releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release()
      } catch {
        // ignore
      }
      this.wakeLock = null
    }
  }

  public isWakeLockActive(): boolean {
    return this.wakeLock !== null
  }

  /** 2. TOÀN MÀN HÌNH BUỒNG LÁI (Fullscreen Kiosk Mode) */
  public toggleFullscreen(): boolean {
    if (typeof document === 'undefined') return false
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      return true
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
      return false
    }
  }

  public isFullscreen(): boolean {
    if (typeof document === 'undefined') return false
    return !!document.fullscreenElement
  }

  /** 3. CHUÔNG ÂM THANH BUỒNG LÁI (Transit Audio Chimes) */
  public playCue(cue: SoundCue) {
    try {
      const ctx = this.getAudioContext()
      if (!ctx) return
      const now = ctx.currentTime

      // Phản hồi rung điện thoại/tablet (nếu thiết bị có motor rung)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          if (cue === 'ticketSuccess') navigator.vibrate(30)
          else if (cue === 'ticketInvalid' || cue === 'ticketDuplicate') navigator.vibrate([100, 50, 100])
          else if (cue === 'stationArrival') navigator.vibrate([150, 100, 200])
          else navigator.vibrate(50)
        } catch {
          // ignore
        }
      }

      switch (cue) {
        // Chuông Ding-Dong cập trạm xe buýt kiểu VinBus / Châu Âu: Nốt D5 (587Hz) ngân sang A4 (440Hz)
        case 'stationArrival': {
          const osc1 = ctx.createOscillator()
          const gain1 = ctx.createGain()
          osc1.type = 'sine'
          osc1.frequency.setValueAtTime(587.33, now) // D5
          gain1.gain.setValueAtTime(0.18, now)
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
          osc1.connect(gain1)
          gain1.connect(ctx.destination)
          osc1.start(now)
          osc1.stop(now + 0.6)

          const osc2 = ctx.createOscillator()
          const gain2 = ctx.createGain()
          osc2.type = 'sine'
          osc2.frequency.setValueAtTime(440.0, now + 0.35) // A4
          gain2.gain.setValueAtTime(0.16, now + 0.35)
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2)
          osc2.connect(gain2)
          gain2.connect(ctx.destination)
          osc2.start(now + 0.35)
          osc2.stop(now + 1.2)
          break
        }

        // Tiếng Tít soát vé QR hợp lệ: Nốt cao thanh C6 (1046Hz) -> E6 (1318Hz)
        case 'ticketSuccess': {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(1046.5, now)
          osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08)
          gain.gain.setValueAtTime(0.15, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.16)
          break
        }

        // Tiếng Cảnh báo vé đã soát trước đó (Trùng lặp): 2 tiếng gắt nhịp đôi
        case 'ticketDuplicate': {
          [0, 0.12].forEach((offset) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sawtooth'
            osc.frequency.setValueAtTime(420, now + offset)
            osc.frequency.setValueAtTime(320, now + offset + 0.06)
            gain.gain.setValueAtTime(0.14, now + offset)
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1)
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.start(now + offset)
            osc.stop(now + offset + 0.1)
          })
          break
        }

        // Tiếng Buzzer vé không hợp lệ / vé giả: Âm trầm gắt (200Hz)
        case 'ticketInvalid': {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sawtooth'
          osc.frequency.setValueAtTime(220, now)
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.3)
          gain.gain.setValueAtTime(0.2, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.35)
          break
        }

        // Xuất bến: Chuông khải hoàn 3 nốt
        case 'tripStart': {
          const notes = [440, 554.37, 659.25] // A4 -> C#5 -> E5
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(freq, now + idx * 0.1)
            gain.gain.setValueAtTime(0.12, now + idx * 0.1)
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25)
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.start(now + idx * 0.1)
            osc.stop(now + idx * 0.1 + 0.25)
          })
          break
        }

        // Về bến: Chuông hạ âm trầm tĩnh
        case 'tripEnd': {
          const notes = [659.25, 523.25, 440]
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(freq, now + idx * 0.12)
            gain.gain.setValueAtTime(0.12, now + idx * 0.12)
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.3)
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.start(now + idx * 0.12)
            osc.stop(now + idx * 0.12 + 0.3)
          })
          break
        }

        // Phản hồi chạm phím xúc giác buồng lái (Tactile Button Tap)
        case 'tap': {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(880, now)
          osc.frequency.exponentialRampToValueAtTime(440, now + 0.04)
          gain.gain.setValueAtTime(0.08, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.04)
          break
        }
      }
    } catch {
      // Audio playback silently guarded
    }
  }

  /** 4. BỘ PHÁT TỌA ĐỘ GPS THỰC TẾ CỦA XE (GPS Broadcaster) */
  public startGpsBroadcasting(
    onLocation: (lat: number, lng: number, speedKmh: number, heading: number) => void,
  ): boolean {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return false
    }

    if (this.gpsWatchId !== null) {
      return true
    }

    try {
      this.isBroadcastingGps = true
      this.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          const speedKmh = Math.max(0, Math.round((pos.coords.speed || 0) * 3.6))
          const heading = Math.round(pos.coords.heading || 0)
          onLocation(lat, lng, speedKmh, heading)
        },
        (err) => {
          console.warn('[DriverHardware] Lỗi Geolocation:', err.message)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000,
        },
      )
      return true
    } catch {
      return false
    }
  }

  public stopGpsBroadcasting() {
    if (this.gpsWatchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.gpsWatchId)
      this.gpsWatchId = null
    }
    this.isBroadcastingGps = false
  }

  public isGpsActive(): boolean {
    return this.isBroadcastingGps
  }
}

export const driverHardware = new DriverHardwareEngine()
