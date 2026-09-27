import type { Metadata } from 'next'
import { LiveTrackingPanel } from '@/components/portal/live-tracking-panel'

interface Props {
  params: Promise<{ tripId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tripId } = await params
  return {
    title: `Theo dõi chuyến ${tripId.slice(0, 8)} | ICTU Smart Transit`,
    description: 'Xem vị trí GPS xe buýt realtime, tốc độ và sự cố trên chuyến.',
  }
}

export default async function TrackingPage({ params }: Props) {
  const { tripId } = await params
  return (
    <div className="min-h-screen bg-[#060a0f] text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <LiveTrackingPanel tripId={tripId} />
      </div>
    </div>
  )
}
