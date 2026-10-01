'use client'

import React, { useEffect, useRef } from 'react'

interface CelebrationFxProps {
  active: boolean
  durationMs?: number
  onComplete?: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  vRot: number
  opacity: number
}

const COLORS = [
  '#005A36', // ICTU Primary Green
  '#10B981', // Emerald
  '#34D399', // Mint
  '#F59E0B', // Champagne Gold
  '#06B6D4', // Electric Cyan
  '#FFFFFF', // Pure White
]

export function CelebrationFx({
  active,
  durationMs = 2800,
  onComplete,
}: CelebrationFxProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const startTime = Date.now()

    // Resize canvas
    const updateSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    updateSize()

    // Create 70 particles
    const particles: Particle[] = Array.from({ length: 70 }, () => {
      const angle = Math.random() * Math.PI - Math.PI / 2
      const speed = Math.random() * 8 + 4
      return {
        x: canvas.width / 2 + (Math.random() - 0.5) * 120,
        y: canvas.height * 0.45 + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: -Math.abs(Math.sin(angle) * speed) - 3,
        size: Math.random() * 8 + 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        opacity: 1,
      }
    })

    const render = () => {
      const elapsed = Date.now() - startTime
      if (elapsed > durationMs) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (onComplete) onComplete()
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const fadeProgress = Math.max(0, 1 - elapsed / durationMs)

      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.22 // gravity
        p.vx *= 0.985 // drag
        p.rotation += p.vRot
        p.opacity = fadeProgress

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity

        // Draw confetti rectangle or circle
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      })

      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [active, durationMs, onComplete])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-70 pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
