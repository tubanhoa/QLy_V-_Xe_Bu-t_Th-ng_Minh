import 'dotenv/config';
import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { ALL_ENTITIES } from './entities/index.js';
import { UserEntity } from './entities/user.entity.js';
import { RoleEntity } from './entities/role.entity.js';
import { UserStatus } from '../common/constants/status.constant.js';
import { Role } from '../common/constants/roles.constant.js';

async function cleanupAndClassifyUsers() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    url,
    entities: ALL_ENTITIES,
    ssl: { rejectUnauthorized: false },
  });

  await ds.initialize();
  console.log('✅ Connected to Supabase PostgreSQL database.');

  const userRepo = ds.getRepository(UserEntity);
  const roleRepo = ds.getRepository(RoleEntity);

  // 1. Fetch current users
  const currentUsers = await userRepo.find({ relations: { role: true } });
  console.log(`\n📋 Tổng số tài khoản hiện tại trong DB: ${currentUsers.length}`);

  // Test email patterns to purge
  const isTestEmail = (email: string) => {
    const lower = email.toLowerCase();
    return (
      lower.startsWith('integration-test-') ||
      lower.startsWith('alias-test-') ||
      lower.startsWith('trips-test-passenger-') ||
      lower.startsWith('test.cloud@') ||
      lower.includes('test-passenger-') ||
      lower.includes('test-user-')
    );
  };

  const testUsers = currentUsers.filter((u) => isTestEmail(u.email));
  const officialUsers = currentUsers.filter((u) => !isTestEmail(u.email));

  console.log(`- 🟢 Tài khoản chính thức: ${officialUsers.length}`);
  officialUsers.forEach((u) => {
    console.log(`   • [${u.role?.name || 'N/A'}] ${u.fullName} (${u.email}) - SV: ${u.studentId || 'N/A'}`);
  });

  console.log(`- 🟡 Tài khoản kiểm thử / rác cần xử lý: ${testUsers.length}`);
  testUsers.forEach((u) => {
    console.log(`   • ${u.email} (ID: ${u.id})`);
  });

  if (testUsers.length > 0) {
    console.log('\n🧹 Đang dọn dẹp các tài khoản kiểm thử và dữ liệu rác liên quan...');
    const testIds = testUsers.map((u) => u.id);

    const cleanTable = async (queryStr: string, params: any[]) => {
      try {
        await ds.query(queryStr, params);
      } catch (e: any) {
        // Ignored if table or column does not exist
      }
    };

    await cleanTable(`DELETE FROM notifications WHERE user_id = ANY($1)`, [testIds]);
    await cleanTable(`DELETE FROM notification_preferences WHERE user_id = ANY($1)`, [testIds]);
    await cleanTable(`DELETE FROM device_tokens WHERE user_id = ANY($1)`, [testIds]);
    await cleanTable(`DELETE FROM seat_holds WHERE user_id = ANY($1)`, [testIds]);
    await cleanTable(`DELETE FROM activity_logs WHERE user_id = ANY($1)`, [testIds]);
    await cleanTable(`DELETE FROM feedback WHERE user_id = ANY($1)`, [testIds]);
    await cleanTable(`DELETE FROM monthly_passes WHERE user_id = ANY($1)`, [testIds]);

    // Xoá các user test
    const deleteResult = await ds.query(`DELETE FROM users WHERE id = ANY($1)`, [testIds]);
    console.log(`✅ Đã loại bỏ thành công ${testIds.length} tài khoản kiểm thử rác khỏi Supabase.`);
  } else {
    console.log('✨ Không có tài khoản kiểm thử rác nào cần xoá.');
  }

  // 2. Bổ sung các tài khoản sinh viên ICTU thực tế chuẩn chỉ (Chuẩn mã SV DTC, Khoa viện ICTU)
  console.log('\n🎓 Đồng bộ và bổ sung tài khoản sinh viên ICTU thực tế...');
  const passengerRole = await roleRepo.findOne({ where: { name: Role.PASSENGER } });
  if (!passengerRole) {
    console.error('❌ Không tìm thấy vai trò passenger');
    await ds.destroy();
    return;
  }

  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

  const realStudents = [
    {
      fullName: 'Hoàng Minh Đức',
      email: 'duc.hm@ictu.edu.vn',
      phoneNumber: '0981234561',
      studentId: 'DTC215180012',
      faculty: 'Khoa Công Nghệ Thông Tin',
      idCardNumber: '001202011001',
    },
    {
      fullName: 'Vũ Thị Phương Thảo',
      email: 'thao.vtp@ictu.edu.vn',
      phoneNumber: '0981234562',
      studentId: 'DTC215180025',
      faculty: 'Khoa Kỹ Thuật Phần Mềm',
      idCardNumber: '001202011002',
    },
    {
      fullName: 'Đặng Quốc Bảo',
      email: 'bao.dq@ictu.edu.vn',
      phoneNumber: '0981234563',
      studentId: 'DTC225180048',
      faculty: 'Khoa Hệ Thống Thông Tin Kinh Tế',
      idCardNumber: '001202011003',
    },
    {
      fullName: 'Phạm Hải Yến',
      email: 'yen.ph@ictu.edu.vn',
      phoneNumber: '0981234564',
      studentId: 'DTC225180099',
      faculty: 'Khoa Truyền Thông Đa Phương Tiện',
      idCardNumber: '001202011004',
    },
    {
      fullName: 'Lê Tuấn Kiệt',
      email: 'kiet.lt@ictu.edu.vn',
      phoneNumber: '0981234565',
      studentId: 'DTC235180120',
      faculty: 'Khoa Điện Tử Viễn Thông',
      idCardNumber: '001202011005',
    },
    {
      fullName: 'Bùi Lan Hương',
      email: 'huong.bl@ictu.edu.vn',
      phoneNumber: '0981234566',
      studentId: 'DTC235180155',
      faculty: 'Khoa Trí Tuệ Nhân Tạo & Khoa Học Dữ Liệu',
      idCardNumber: '001202011006',
    },
  ];

  for (const s of realStudents) {
    const existing = await userRepo.findOne({ where: { email: s.email } });
    if (!existing) {
      const newUser = userRepo.create({
        fullName: s.fullName,
        email: s.email,
        phoneNumber: s.phoneNumber,
        passwordHash: defaultPasswordHash,
        roleId: passengerRole.id,
        studentId: s.studentId,
        faculty: s.faculty,
        idCardNumber: s.idCardNumber,
        status: UserStatus.ACTIVE,
      });
      await userRepo.save(newUser);
      console.log(`   ➕ Đã tạo sinh viên thực tế: ${s.fullName} (${s.studentId} - ${s.faculty})`);
    } else {
      // Đảm bảo thông tin khoa và studentId được chuẩn hóa
      existing.studentId = s.studentId;
      existing.faculty = s.faculty;
      existing.fullName = s.fullName;
      await userRepo.save(existing);
      console.log(`   ✨ Đã chuẩn hóa sinh viên: ${s.fullName} (${s.studentId})`);
    }
  }

  // 3. Hiển thị danh sách tài khoản chính thức cuối cùng
  const updatedUsers = await userRepo.find({ relations: { role: true }, order: { createdAt: 'ASC' } });
  console.log(`\n🎉 HOÀN THÀNH! Danh sách toàn bộ ${updatedUsers.length} tài khoản người dùng chính thức trong Database:`);
  console.log('-------------------------------------------------------------------------------------------------');
  updatedUsers.forEach((u, idx) => {
    const roleStr = (u.role?.name || 'passenger').toUpperCase().padEnd(10);
    const svStr = u.studentId ? `[SV: ${u.studentId}]`.padEnd(18) : ''.padEnd(18);
    const facultyStr = u.faculty ? `(${u.faculty})` : '';
    console.log(`${(idx + 1).toString().padStart(2)}. [${roleStr}] ${u.fullName.padEnd(25)} | ${u.email.padEnd(30)} ${svStr} ${facultyStr}`);
  });

  await ds.destroy();
}

cleanupAndClassifyUsers().catch((err) => {
  console.error('❌ Lỗi khi dọn dẹp và phân loại người dùng:', err);
  process.exit(1);
});
