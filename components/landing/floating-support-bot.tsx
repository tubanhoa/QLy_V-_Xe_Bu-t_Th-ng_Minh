'use client'

import { useEffect, useState } from 'react'
import {
  Bot,
  MessageCircle,
  PhoneCall,
  Send,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CONTACT } from '@/lib/landing-data'

export function FloatingSupportBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [messages, setMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string }>>([
    {
      sender: 'bot',
      text: 'Xin chào! Mình là trợ lý ảo ICTU Transit Bot 🤖. Mình có thể hỗ trợ gì cho hành trình di chuyển của bạn hôm nay?',
    },
  ])
  const [inputVal, setInputVal] = useState('')

  // Proactively pop up a gentle greeting hint after 2.5s
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(true), 2500)
    return () => clearTimeout(timer)
  }, [])

  const handleSend = (text?: string) => {
    const query = text || inputVal
    if (!query.trim()) return

    setMessages((prev) => [...prev, { sender: 'user', text: query }])
    if (!text) setInputVal('')

    setTimeout(() => {
      let reply = 'Cảm ơn bạn! Ban điều phối xe buýt ICTU đã ghi nhận thông tin và sẽ hỗ trợ bạn ngay.'
      const lower = query.toLowerCase()
      if (lower.includes('vé tháng') || lower.includes('sinh viên')) {
        reply = 'Vé tháng sinh viên ICTU được trợ giá 50% (chỉ 100.000đ/tháng). Bạn có thể đăng ký trực tuyến bằng cách nộp ảnh thẻ SV tại mục "Đăng ký vé tháng".'
      } else if (lower.includes('giờ') || lower.includes('lịch') || lower.includes('chuyến')) {
        reply = 'Tuyến CT-01 xuất bến từ KTX ICTU từ 06:00 đến 21:00 hàng ngày, tần suất 15 phút/chuyến vào giờ cao điểm.'
      } else if (lower.includes('hotline') || lower.includes('khẩn cấp') || lower.includes('quên')) {
        reply = `Bạn hãy gọi ngay hotline khẩn cấp 24/7: ${CONTACT.hotline} để được điều phối viên hỗ trợ tìm đồ hoặc đón gấp.`
      }

      setMessages((prev) => [...prev, { sender: 'bot', text: reply }])
    }, 600)
  }

  return (
    <>
      {/* Unified Single Floating Support Capsule in Bottom Right with Idle Levitation */}
      <div className="fixed bottom-5 right-5 z-40 animate-bot-breathe">
        {/* Subtle proactive speech bubble prompt */}
        {!isOpen && showHint && (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setIsOpen(true)
                setShowHint(false)
              }
            }}
            onClick={() => {
              setIsOpen(true)
              setShowHint(false)
            }}
            className="cursor-pointer absolute -top-11 right-0 flex items-center gap-1.5 rounded-2xl bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xl border border-emerald-200/80 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300 hover:scale-105 transition-transform"
          >
            <span className="relative flex size-2 items-center justify-center">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 animate-ping opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="whitespace-nowrap">Tìm xe nhanh? Nhắn mình nhé! 💬</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowHint(false)
              }}
              className="text-slate-400 hover:text-slate-600 ml-1 p-0.5"
              aria-label="Đóng lời nhắc"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen)
            setShowHint(false)
          }}
          aria-label={isOpen ? 'Đóng trợ lý ảo' : 'Mở trợ lý ảo ICTU Bus 24/7'}
          className={cn(
            'flex items-center gap-2.5 rounded-full bg-[#005A36] px-4 py-2.5 text-white shadow-xl shadow-emerald-950/25 border-2 border-white/95 backdrop-blur-md transition-all duration-200 hover:bg-[#004529] active:scale-95',
            isOpen ? 'px-3 py-3' : '',
          )}
        >
          {isOpen ? (
            <X size={20} strokeWidth={2.5} className="text-white" />
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <Bot size={22} strokeWidth={2.2} className="text-white" />
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400" />
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
              </div>
              <div className="text-left leading-tight pr-1">
                <span className="block text-xs font-black text-white tracking-wide">Trợ lý ICTU Bus</span>
                <span className="block text-[10px] font-semibold text-emerald-200">Trực tuyến 24/7</span>
              </div>
            </>
          )}
        </button>
      </div>

      {/* Interactive Chat Popup Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-40 w-[90vw] max-w-sm rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden flex flex-col h-[480px] animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="bg-[#005A36] p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-white/15 border border-white/20">
                <Bot size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  ICTU Transit Assistant
                  <Sparkles size={13} className="text-emerald-300" />
                </h3>
                <p className="text-[11px] text-emerald-100 font-medium">Hỗ trợ hành khách 24/7</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick FAQ Chips */}
          <div className="bg-slate-50 border-b border-slate-100 p-2.5 flex items-center gap-2 overflow-x-auto text-[11px] font-semibold text-slate-700">
            <button
              type="button"
              onClick={() => handleSend('Lịch chạy xe buýt hôm nay?')}
              className="shrink-0 rounded-full bg-white border border-slate-200 px-2.5 py-1 hover:border-[#005A36] hover:text-[#005A36]"
            >
              🕒 Giờ xe chạy
            </button>
            <button
              type="button"
              onClick={() => handleSend('Đăng ký vé tháng sinh viên giảm 50%?')}
              className="shrink-0 rounded-full bg-white border border-slate-200 px-2.5 py-1 hover:border-[#005A36] hover:text-[#005A36]"
            >
              🎓 Vé tháng HSSV
            </button>
            <button
              type="button"
              onClick={() => handleSend('Hotline khẩn cấp 24/7')}
              className="shrink-0 rounded-full bg-white border border-slate-200 px-2.5 py-1 hover:border-[#005A36] hover:text-[#005A36]"
            >
              📞 Hotline
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn('flex', m.sender === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[82%] rounded-2xl p-3 leading-relaxed',
                    m.sender === 'user'
                      ? 'bg-[#005A36] text-white rounded-br-none'
                      : 'bg-slate-100 text-slate-800 rounded-bl-none',
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="border-t border-slate-100 p-2.5 flex items-center gap-2 bg-white"
          >
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-800 outline-none focus:border-[#005A36]"
            />
            <button
              type="submit"
              className="flex size-9 items-center justify-center rounded-full bg-[#005A36] text-white hover:bg-emerald-800 transition-colors"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
