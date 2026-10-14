import { redirect } from 'next/navigation'

export default function MyTicketsRoute() {
  redirect('/?openTickets=true')
}
