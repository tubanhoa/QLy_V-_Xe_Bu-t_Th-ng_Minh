'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Calculator,
  Loader2,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react'
import { transitService } from '@/lib/services/transit.service'
import type {
  TransitRoute,
  PricingType,
  DistanceFareRule,
  UpdatePricingPayload,
  CalculateFareResponse,
} from '@/lib/types/transit'

interface FareConfigModalProps {
  isOpen: boolean
  onClose: () => void
  route: TransitRoute | null
  onSuccess: (updatedRoute: TransitRoute) => void
}

const DEFAULT_DISTANCE_RULES: DistanceFareRule[] = [
  { minKm: 0, maxKm: 5, price: 7000, studentPrice: 4000 },
  { minKm: 5, maxKm: 10, price: 10000, studentPrice: 5000 },
  { minKm: 10, maxKm: 999, price: 15000, studentPrice: 8000 },
]

export function FareConfigModal({
  isOpen,
  onClose,
  route,
  onSuccess,
}: FareConfigModalProps) {
  const [pricingType, setPricingType] = useState<PricingType>('fixed')
  const [basePrice, setBasePrice] = useState<number>(10000)
  const [studentPrice, setStudentPrice] = useState<number>(5000)
  const [distanceRules, setDistanceRules] = useState<DistanceFareRule[]>(DEFAULT_DISTANCE_RULES)

  // Sandbox Test
  const [testPickupId, setTestPickupId] = useState('')
  const [testDropoffId, setTestDropoffId] = useState('')
  const [testIsStudent, setTestIsStudent] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<CalculateFareResponse | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!isOpen || !route) return

    setPricingType((route.pricingType as PricingType) || 'fixed')
    setBasePrice(Number(route.basePrice) || 10000)
    setStudentPrice(Number(route.studentPrice) || Math.round(Number(route.basePrice) * 0.5) || 5000)

    if (Array.isArray(route.fareRules) && route.fareRules.length > 0) {
      setDistanceRules(route.fareRules)
    } else {
      setDistanceRules(DEFAULT_DISTANCE_RULES)
    }

    setTestResult(null)
    setTestError(null)
    setFeedback(null)

    // Khởi tạo trạm thử nghiệm nếu có
    if (route.routeStations && route.routeStations.length >= 2) {
      setTestPickupId(route.routeStations[0].stationId)
      setTestDropoffId(route.routeStations[route.routeStations.length - 1].stationId)
    }
  }, [isOpen, route])

  if (!isOpen || !route) return null

  // Thêm bậc thang cự ly
  const handleAddTier = () => {
    const lastRule = distanceRules[distanceRules.length - 1]
    const newMin = lastRule ? lastRule.maxKm : 0
    const newMax = newMin + 5
    const newPrice = lastRule ? lastRule.price + 3000 : 8000
    const newStudentPrice = Math.round(newPrice * 0.5)

    setDistanceRules([
      ...distanceRules,
      { minKm: newMin, maxKm: newMax, price: newPrice, studentPrice: newStudentPrice },
    ])
  }

  // Xóa bậc thang
  const handleRemoveTier = (index: number) => {
    if (distanceRules.length <= 1) return
    setDistanceRules(distanceRules.filter((_, i) => i !== index))
  }

  // Sửa bậc thang
  const handleRuleChange = (
    index: number,
    field: keyof DistanceFareRule,
    value: number,
  ) => {
    const updated = [...distanceRules]
    updated[index] = {
      ...updated[index],
      [field]: value,
    }
    setDistanceRules(updated)
  }

  // =========================================================================
  // SANDBOX TEST TÍNH GIÁ VÉ TỨC THÌ
  // =========================================================================
  const handleRunFareTest = async () => {
    if (!testPickupId || !testDropoffId) {
      setTestError('Vui lòng chọn trạm đón và trạm trả để thử nghiệm!')
      return
    }
    if (testPickupId === testDropoffId) {
      setTestError('Trạm đón và trạm trả không được trùng nhau!')
      return
    }

    setIsTesting(true)
    setTestError(null)

    try {
      const res = await transitService.calculateFare(route.id, {
        pickupStationId: testPickupId,
        dropoffStationId: testDropoffId,
        isStudent: testIsStudent,
      })

      if (res.success && res.data) {
        setTestResult(res.data)
      } else {
        setTestError(res.message || 'Không thể tính giá vé!')
      }
    } catch (err: any) {
      setTestError(err?.message || 'Lỗi khi gọi API tính giá vé!')
    } finally {
      setIsTesting(false)
    }
  }

  // =========================================================================
  // LƯU CẤU HÌNH BIỂU PHÍ VỀ DATABASE
  // =========================================================================
  const handleSubmitPricing = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const payload: UpdatePricingPayload = {
        pricingType,
        basePrice: Number(basePrice),
        studentPrice: Number(studentPrice),
        ...(pricingType === 'distance' ? { fareRules: distanceRules } : {}),
      }

      const res = await transitService.updatePricing(route.id, payload)
      if (res.success && res.data) {
        onSuccess(res.data)
        setFeedback({
          type: 'success',
          message: 'Cập nhật cấu hình biểu phí thành công lên Database!',
        })
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Lỗi khi lưu biểu phí!',
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Có lỗi phát sinh khi lưu biểu phí!',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <DollarSign size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Cấu Hình Biểu Phí: {route.routeCode}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thiết lập giá vé cố định hoặc linh hoạt theo cự ly khoảng cách km
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body Form */}
        <form onSubmit={handleSubmitPricing} className="flex-1 overflow-y-auto p-6 space-y-6">
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Chọn 1 trong 3 cơ chế định giá */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
              Chọn cơ chế tính giá vé áp dụng:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'fixed' as PricingType,
                  title: 'Đồng giá Toàn tuyến',
                  desc: 'Áp dụng 1 mức giá duy nhất không phân biệt trạm lên xuống',
                },
                {
                  id: 'distance' as PricingType,
                  title: 'Theo Khoảng cách (km)',
                  desc: 'Tính theo số km thực tế giữa trạm đón và trạm trả',
                },
                {
                  id: 'stage' as PricingType,
                  title: 'Theo Số Chặng / Trạm',
                  desc: 'Tính lũy tiến theo số lượng trạm dừng đi qua',
                },
              ].map((item) => {
                const isSelected = pricingType === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPricingType(item.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 shadow-xs ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black">{item.title}</span>
                      {isSelected && <CheckCircle2 size={15} className="text-amber-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Giá vé cơ bản & Sinh viên (Áp dụng cho mọi cơ chế) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                Giá vé mở cửa / Giá chuẩn (VND)
              </label>
              <input
                type="number"
                step="1000"
                min="1000"
                value={basePrice}
                onChange={(e) => setBasePrice(parseInt(e.target.value, 10) || 0)}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-black text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                Giá vé ưu đãi Sinh viên ICTU (VND)
              </label>
              <input
                type="number"
                step="1000"
                min="0"
                value={studentPrice}
                onChange={(e) => setStudentPrice(parseInt(e.target.value, 10) || 0)}
                className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-black text-emerald-600 dark:text-emerald-400 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Cấu hình bảng bậc thang nếu chọn "distance" */}
          {pricingType === 'distance' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    Bảng Biểu Phí Bậc Thang Cự Ly (Distance Tiers)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Hệ thống sẽ tra cứu cự ly thực tế giữa 2 trạm để áp dụng mức giá tương ứng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddTier}
                  className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center gap-1 hover:bg-amber-100 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Thêm bậc</span>
                </button>
              </div>

              <div className="space-y-2">
                {distanceRules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-3 text-xs"
                  >
                    <span className="size-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 shrink-0">
                      {idx + 1}
                    </span>

                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-medium">Từ</span>
                        <input
                          type="number"
                          value={rule.minKm}
                          onChange={(e) =>
                            handleRuleChange(idx, 'minKm', parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-16 text-center rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold"
                        />
                        <span className="text-slate-400">km</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-medium">Đến</span>
                        <input
                          type="number"
                          value={rule.maxKm}
                          onChange={(e) =>
                            handleRuleChange(idx, 'maxKm', parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-16 text-center rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold"
                        />
                        <span className="text-slate-400">km</span>
                      </div>

                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-slate-500 font-bold">Giá vé:</span>
                        <input
                          type="number"
                          step="1000"
                          value={rule.price}
                          onChange={(e) =>
                            handleRuleChange(idx, 'price', parseInt(e.target.value, 10) || 0)
                          }
                          className="h-8 w-24 text-center rounded-xl border border-amber-300 dark:border-amber-700 font-mono font-black text-amber-700 dark:text-amber-400"
                        />
                        <span className="text-slate-400">đ</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-emerald-600 font-bold">SV:</span>
                        <input
                          type="number"
                          step="1000"
                          value={rule.studentPrice || Math.round(rule.price * 0.5)}
                          onChange={(e) =>
                            handleRuleChange(
                              idx,
                              'studentPrice',
                              parseInt(e.target.value, 10) || 0,
                            )
                          }
                          className="h-8 w-20 text-center rounded-xl border border-emerald-300 dark:border-emerald-700 font-mono font-black text-emerald-700 dark:text-emerald-400"
                        />
                        <span className="text-slate-400">đ</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveTier(idx)}
                      disabled={distanceRules.length <= 1}
                      className="size-7 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-20 cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SANDBOX THỬ NGHIỆM GIÁ VÉ TỨC THÌ (INSTANT FARE CALCULATOR TESTER) */}
          <div className="p-4 rounded-3xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
            <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-black text-xs">
              <Calculator size={16} className="text-indigo-600" />
              <span>Sandbox Kiểm Thử Giá Vé Tức Thì (Instant Calculation):</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <select
                  value={testPickupId}
                  onChange={(e) => setTestPickupId(e.target.value)}
                  className="h-9 w-full rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Chọn trạm đón --</option>
                  {route.routeStations?.map((s) => (
                    <option key={s.stationId} value={s.stationId}>
                      {s.stopOrder}. {s.station?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5">
                <select
                  value={testDropoffId}
                  onChange={(e) => setTestDropoffId(e.target.value)}
                  className="h-9 w-full rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Chọn trạm trả --</option>
                  {route.routeStations?.map((s) => (
                    <option key={s.stationId} value={s.stationId}>
                      {s.stopOrder}. {s.station?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleRunFareTest}
                  disabled={isTesting || !testPickupId || !testDropoffId}
                  className="h-9 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isTesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>Tính thử</span>
                </button>
              </div>
            </div>

            {testError && (
              <p className="text-[11px] text-rose-600 font-bold">{testError}</p>
            )}

            {testResult && (
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800/60 space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Cự ly: <strong>{testResult.distanceKm} km</strong> ({testResult.passedStopsCount} trạm đi qua)
                  </span>
                  <span className="font-mono text-sm font-black text-emerald-600">
                    {testResult.finalPrice.toLocaleString('vi-VN')} VND
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Lộ trình: {testResult.pickupStation.name} ➔ {testResult.dropoffStation.name}
                </p>
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-black text-xs shadow-md shadow-amber-900/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Lưu Biểu Phí Tuyến</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
