/**
 * Web Audio & Vibration Haptic Feedback Utility
 * 100% native browser API - Zero external assets or network latency.
 * Provides delightful physical feedback for touches, seat toggles, and ticket wins.
 */

type HapticSoundType = 'tap' | 'select' | 'pop' | 'success' | 'warning' | 'copy' | 'busArrival'

class HapticManager {
  private ctx: AudioContext | null = null
  private isMuted: boolean = false

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  public play(type: HapticSoundType = 'tap') {
    // 1. Physical vibration if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        switch (type) {
          case 'tap':
            navigator.vibrate(10)
            break
          case 'select':
            navigator.vibrate(15)
            break
          case 'copy':
            navigator.vibrate([10, 30, 10])
            break
          case 'success':
            navigator.vibrate([20, 50, 20, 50, 40])
            break
          case 'warning':
            navigator.vibrate([40, 40, 40])
            break
          case 'busArrival':
            // Rung thông báo nhịp đôi dứt khoát: rung 150ms -> nghỉ 80ms -> rung 250ms
            navigator.vibrate([150, 80, 250])
            break
          default:
            navigator.vibrate(12)
        }
      } catch {
        // ignore device vibration restrictions
      }
    }

    if (this.isMuted) return

    // 2. Synthesized acoustic micro-sound
    try {
      const ctx = this.getContext()
      if (!ctx) return

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      switch (type) {
        case 'tap': {
          osc.type = 'sine'
          osc.frequency.setValueAtTime(620, now)
          osc.frequency.exponentialRampToValueAtTime(380, now + 0.035)
          gain.gain.setValueAtTime(0.04, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)
          osc.start(now)
          osc.stop(now + 0.035)
          break
        }
        case 'select': {
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(520, now)
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.045)
          gain.gain.setValueAtTime(0.06, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045)
          osc.start(now)
          osc.stop(now + 0.045)
          break
        }
        case 'pop': {
          osc.type = 'sine'
          osc.frequency.setValueAtTime(750, now)
          osc.frequency.exponentialRampToValueAtTime(1100, now + 0.04)
          gain.gain.setValueAtTime(0.05, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
          osc.start(now)
          osc.stop(now + 0.04)
          break
        }
        case 'copy': {
          osc.type = 'sine'
          osc.frequency.setValueAtTime(800, now)
          osc.frequency.setValueAtTime(1050, now + 0.03)
          gain.gain.setValueAtTime(0.05, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
          osc.start(now)
          osc.stop(now + 0.06)
          break
        }
        case 'success': {
          // Melodic arpeggio chord: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
          const notes = [523.25, 659.25, 783.99, 1046.5]
          notes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator()
            const noteGain = ctx.createGain()
            noteOsc.type = 'triangle'
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.06)
            noteOsc.connect(noteGain)
            noteGain.connect(ctx.destination)

            noteGain.gain.setValueAtTime(0.08, now + idx * 0.06)
            noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18)

            noteOsc.start(now + idx * 0.06)
            noteOsc.stop(now + idx * 0.06 + 0.18)
          })
          break
        }
        case 'warning': {
          osc.type = 'sawtooth'
          osc.frequency.setValueAtTime(320, now)
          osc.frequency.setValueAtTime(260, now + 0.08)
          gain.gain.setValueAtTime(0.06, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
          osc.start(now)
          osc.stop(now + 0.16)
          break
        }
        case 'busArrival': {
          // Chuông thông báo xe cập bến 3 nốt cao du dương: F5 (698.46Hz) -> A5 (880Hz) -> C6 (1046.5Hz)
          const chimeNotes = [698.46, 880.0, 1046.5]
          chimeNotes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator()
            const noteGain = ctx.createGain()
            noteOsc.type = 'sine'
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.12)
            noteOsc.connect(noteGain)
            noteGain.connect(ctx.destination)

            noteGain.gain.setValueAtTime(0.08, now + idx * 0.12)
            noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.32)

            noteOsc.start(now + idx * 0.12)
            noteOsc.stop(now + idx * 0.12 + 0.32)
          })
          break
        }
      }
    } catch {
      // Audio playback silently guarded
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted
  }

  public getIsMuted(): boolean {
    return this.isMuted
  }
}

export const haptic = new HapticManager()
