import { redirect } from 'next/navigation'

export default function MonthlyPassRoute() {
  redirect('/?openMonthlyPass=true')
}
