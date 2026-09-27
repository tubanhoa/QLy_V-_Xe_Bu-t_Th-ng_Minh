'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { bookingService } from '@/lib/services/booking.service'
import { SeatItem, SeatMapData } from '@/lib/types/booking'
import { useAuth } from '@/lib/auth-context'

interface UseSeatLockProps {
  tripId?: string | null
  enabled?: boolean
}

export function useSeatLock({ tripId, enabled = true }: UseSeatLockProps) {
  const { isAuthenticated } = useAuth()
  const [seatMap, setSeatMap] = useState<SeatMapData | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<SeatItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isHoldingAction, setIsHoldingAction] = useState(false)
  const [conflictedSeatId, setConflictedSeatId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Tải sơ đồ ghế ban đầu từ Backend
  const fetchSeatMap = useCallback(async (isSilent = false) => {
    if (!tripId || !enabled) return
    if (!isSilent) setIsLoading(true)

    try {
      const res = await bookingService.getSeatMap(tripId)
      if (res.success && res.data) {
        setSeatMap(res.data)

        // Tự động nhận diện nếu người dùng đang có ghế đang giữ (isHeldByMe)
        const myHeld = res.data.seats.filter((s) => s.isHeldByMe)
        if (myHeld.length > 0) {
          setSelectedSeats(myHeld)
          // Tìm thời gian hết hạn sớm nhất
          const expireTimes = myHeld
            .map((s) => (s.holdExpiresAt ? new Date(s.holdExpiresAt).getTime() : 0))
            .filter((t) => t > Date.now())

          if (expireTimes.length > 0) {
            const minTime = Math.min(...expireTimes)
            setHoldExpiresAt(minTime)
          }
        }
      } else {
        if (!isSilent) {
          setErrorMessage(res.message || 'Không thể tải sơ đồ ghế')
        }
      }
    } catch (err: any) {
      if (!isSilent) {
        setErrorMessage(err?.message || 'Lỗi kết nối máy chủ')
      }
    } finally {
      if (!isSilent) setIsLoading(false)
    }
  }, [tripId, enabled])

  // 2. Kích hoạt tải và polling ngầm mỗi 6 giây để cập nhật trạng thái ghế
  useEffect(() => {
    if (!tripId || !enabled) return

    fetchSeatMap(false)

    // Polling ngầm mỗi 6s để cập nhật ghế người khác vừa đặt/giữ
    pollingRef.current = setInterval(() => {
      fetchSeatMap(true)
    }, 6000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [tripId, enabled, fetchSeatMap])

  // 3. Đếm ngược thời gian giữ chỗ
  useEffect(() => {
    if (!holdExpiresAt || selectedSeats.length === 0) {
      setRemainingSeconds(0)
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000))
      setRemainingSeconds(diff)

      if (diff <= 0) {
        // Hết thời gian giữ chỗ
        if (timerRef.current) clearInterval(timerRef.current)
        setHoldExpiresAt(null)
        setSelectedSeats([])
        setErrorMessage('Thời gian giữ chỗ (10 phút) đã hết. Vui lòng chọn lại ghế.')
        fetchSeatMap(false)
      }
    }

    updateTimer()
    timerRef.current = setInterval(updateTimer, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [holdExpiresAt, selectedSeats.length, fetchSeatMap])

  // 4. Chọn hoặc Bỏ chọn ghế với API Anti-Race-Condition
  const toggleSeat = async (seat: SeatItem) => {
    if (!tripId || isHoldingAction) return

    const isAlreadySelected = selectedSeats.some((s) => s.seatId === seat.seatId)

    setErrorMessage(null)
    setConflictedSeatId(null)

    // Trường hợp 1: Bỏ chọn ghế đang giữ -> Gọi API giải phóng lock
    if (isAlreadySelected) {
      setIsHoldingAction(true)
      try {
        const res = await bookingService.releaseSeats({
          tripId,
          seatIds: [seat.seatId],
        })

        if (res.success) {
          const updated = selectedSeats.filter((s) => s.seatId !== seat.seatId)
          setSelectedSeats(updated)
          if (updated.length === 0) {
            setHoldExpiresAt(null)
          }
          // Cập nhật trạng thái ghế trên sơ đồ
          setSeatMap((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              holdingCount: Math.max(0, prev.holdingCount - 1),
              availableCount: prev.availableCount + 1,
              seats: prev.seats.map((s) =>
                s.seatId === seat.seatId
                  ? { ...s, bookingStatus: 'available', isHeldByMe: false, holdExpiresAt: null }
                  : s,
              ),
            }
          })
        }
      } catch (err: any) {
        console.error('Lỗi khi hủy giữ ghế:', err)
      } finally {
        setIsHoldingAction(false)
      }
      return
    }

    // Trường hợp 2: Không được giữ quá 5 ghế
    if (selectedSeats.length >= 5) {
      setErrorMessage('Mỗi hành khách chỉ được giữ tối đa 5 ghế trong một lượt.')
      return
    }

    // Trường hợp 3: Chọn ghế trống -> Gọi API giữ chỗ chống Race Condition
    setIsHoldingAction(true)

    // Optimistic UI: Tạm đánh dấu ghế đang được người dùng bấm
    setSeatMap((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        seats: prev.seats.map((s) =>
          s.seatId === seat.seatId
            ? { ...s, bookingStatus: 'holding', isHeldByMe: true }
            : s,
        ),
      }
    })

    // Nếu chưa đăng nhập: Cho phép chọn ghế trực quan (Guest mode) mà không chặn trải nghiệm
    if (!isAuthenticated) {
      const newHeldSeat: SeatItem = {
        ...seat,
        bookingStatus: 'holding',
        isHeldByMe: true,
      }
      setSelectedSeats((prev) => [...prev, newHeldSeat])
      setHoldExpiresAt(Date.now() + 600 * 1000)
      setIsHoldingAction(false)
      return
    }

    try {
      const res = await bookingService.holdSeats({
        tripId,
        seatIds: [seat.seatId],
      })

      if (res.statusCode === 401) {
        // Token hết hạn hoặc không hợp lệ -> fallback chọn ghế cục bộ
        const newHeldSeat: SeatItem = {
          ...seat,
          bookingStatus: 'holding',
          isHeldByMe: true,
        }
        setSelectedSeats((prev) => [...prev, newHeldSeat])
        setHoldExpiresAt(Date.now() + 600 * 1000)
        return
      }

      if (res.success && res.data?.success) {
        // Giữ ghế thành công!
        const newHeldSeat: SeatItem = {
          ...seat,
          bookingStatus: 'holding',
          isHeldByMe: true,
        }
        setSelectedSeats((prev) => [...prev, newHeldSeat])

        // Thiết lập đồng hồ 10 phút (TTL 600s)
        const expiresTime = res.data.expiresAt
          ? new Date(res.data.expiresAt).getTime()
          : Date.now() + 600 * 1000
        setHoldExpiresAt(expiresTime)
      } else {
        // Xung đột Race Condition (HTTP 409 Conflict): Có người khác bấm trước!
        setConflictedSeatId(seat.seatId)
        setErrorMessage(
          res.message ||
            `Ghế ${seat.seatNumber} vừa được hành khách khác giữ chỗ trước bạn. Vui lòng chọn ghế khác.`,
        )

        // Hoàn nguyên trạng thái ghế sang "Người khác đang giữ"
        setSeatMap((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            seats: prev.seats.map((s) =>
              s.seatId === seat.seatId
                ? { ...s, bookingStatus: 'holding', isHeldByMe: false }
                : s,
            ),
          }
        })

        // Tải lại sơ đồ ghế chuẩn từ server
        fetchSeatMap(true)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể gửi yêu cầu giữ ghế')
      fetchSeatMap(true)
    } finally {
      setIsHoldingAction(false)
    }
  }

  // 5. Giải phóng toàn bộ ghế đang giữ khi người dùng hủy bỏ hoặc đóng modal
  const releaseAllHeldSeats = async () => {
    if (!tripId || selectedSeats.length === 0) return
    const ids = selectedSeats.map((s) => s.seatId)
    setSelectedSeats([])
    setHoldExpiresAt(null)
    try {
      await bookingService.releaseSeats({ tripId, seatIds: ids })
    } catch {
      // bỏ qua lỗi khi cleanup
    }
  }

  return {
    seatMap,
    selectedSeats,
    isLoading,
    isHoldingAction,
    conflictedSeatId,
    errorMessage,
    remainingSeconds,
    holdExpiresAt,
    toggleSeat,
    releaseAllHeldSeats,
    refreshSeatMap: () => fetchSeatMap(false),
  }
}
