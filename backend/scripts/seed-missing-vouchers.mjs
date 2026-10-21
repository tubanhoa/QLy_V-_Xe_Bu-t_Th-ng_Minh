import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.qcgcmefeqrdavuyyiheu:ictuXeBus2026@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  const vouchersToSeed = [
    {
      code: 'ICTU_BUS10K',
      description: 'Trợ giá kích cầu tuyến xe buýt Thái Nguyên - Trừ thẳng 10.000đ trực tiếp vào giá vé lượt',
      discount_type: 'fixed_amount',
      discount_value: 10000,
      min_order_value: 5000,
      max_discount_amount: null,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      usage_limit: 300,
      used_count: 88,
      applicable_type: 'single_ticket',
      status: 'active',
    },
    {
      code: 'VETHANG_50K',
      description: 'Giảm 50.000đ khi đăng ký mới hoặc gia hạn vé tháng liên tuyến ĐH Thái Nguyên',
      discount_type: 'fixed_amount',
      discount_value: 50000,
      min_order_value: 100000,
      max_discount_amount: null,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      usage_limit: 200,
      used_count: 65,
      applicable_type: 'monthly_pass',
      status: 'active',
    },
    {
      code: 'CUOITUAN_VUI',
      description: 'Kích cầu di chuyển cuối tuần - Giảm 15% tối đa 20.000đ cho các chuyến xe thứ 7 & chủ nhật',
      discount_type: 'percentage',
      discount_value: 15,
      min_order_value: 20000,
      max_discount_amount: 20000,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      usage_limit: 400,
      used_count: 110,
      applicable_type: 'single_ticket',
      status: 'active',
    },
    {
      code: 'HE2025_EXP',
      description: 'Ưu đãi kích cầu mùa hè 2025 - Giảm 25.000đ cho vé tháng sinh viên (Đã kết thúc)',
      discount_type: 'fixed_amount',
      discount_value: 25000,
      min_order_value: 80000,
      max_discount_amount: null,
      start_date: '2025-06-01',
      end_date: '2025-08-31',
      usage_limit: 500,
      used_count: 480,
      applicable_type: 'monthly_pass',
      status: 'active',
    },
  ];

  for (const v of vouchersToSeed) {
    const existing = await client.query('SELECT id FROM vouchers WHERE code = $1', [v.code]);
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO vouchers (code, description, discount_type, discount_value, min_order_value, max_discount_amount, start_date, end_date, usage_limit, used_count, applicable_type, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        [
          v.code,
          v.description,
          v.discount_type,
          v.discount_value,
          v.min_order_value,
          v.max_discount_amount,
          v.start_date,
          v.end_date,
          v.usage_limit,
          v.used_count,
          v.applicable_type,
          v.status,
        ]
      );
      console.log('Seeded voucher:', v.code);
    } else {
      await client.query('UPDATE vouchers SET min_order_value = $1 WHERE code = $2', [v.min_order_value, v.code]);
      console.log('Updated voucher min_order_value:', v.code);
    }
  }

  const all = await client.query('SELECT code, status, end_date, applicable_type FROM vouchers ORDER BY created_at DESC');
  console.log('Total vouchers now in DB:', all.rows.length);
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
