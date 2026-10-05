import { DataSource } from 'typeorm'
import * as dotenv from 'dotenv'
dotenv.config()

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await ds.initialize()
  console.log('Connected to database...')

  const students = await ds.query(
    "SELECT id, full_name, email, phone_number, student_id, faculty FROM users WHERE student_id IS NOT NULL LIMIT 5"
  )
  console.log(`Found ${students.length} students.`)

  const routes = await ds.query('SELECT id, route_code, name FROM routes LIMIT 2')
  console.log(`Found ${routes.length} routes.`)

  if (students.length > 0 && routes.length > 0) {
    const existing = await ds.query('SELECT count(*) FROM monthly_passes')
    if (parseInt(existing[0].count) === 0) {
      console.log('Seeding initial monthly pass applications for students...')
      for (let i = 0; i < students.length; i++) {
        const s = students[i]
        const r = routes[i % routes.length]
        const passCode = 'MP-202610-' + String(1001 + i)
        await ds.query(
          `INSERT INTO monthly_passes (id, user_id, route_id, pass_code, category, start_date, end_date, proof_image_url, price, approval_status, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, 'student', '2026-10-01', '2026-10-31', $4, 100000, 'pending', NOW())`,
          [
            s.id,
            r.id,
            passCode,
            'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
          ]
        )
      }
      console.log('Seeded monthly passes successfully!')
    } else {
      console.log(`Monthly passes already exist (${existing[0].count} records).`)
    }
  }

  await ds.destroy()
}

main().catch(console.error)
