import { NextResponse } from 'next/server'
import type { RegisterPayload, RegisterResponse } from '@/lib/types/sprint1'

/**
 * API Đăng Ký Tài Khoản (Sprint 1)
 * Endpoint: POST /api/auth/register
 * 
 * Dành cho Backend Team (Trí, Vinh, Việt):
 * - Đã định nghĩa chuẩn schema và validate đầu vào.
 * - Hiện đang trả về Mock response 200 OK.
 * - Hãy kết nối CSDL (Prisma/TypeORM/Mongoose) tại hàm này.
 */
export async function POST(request: Request) {
  try {
    const body: RegisterPayload = await request.json()

    // 1. Kiểm tra trường bắt buộc
    if (!body.fullName || !body.email || !body.phoneNumber || !body.password) {
      return NextResponse.json<RegisterResponse>(
        {
          success: false,
          message: 'Vui lòng điền đầy đủ các thông tin bắt buộc: Họ tên, Email, Số điện thoại và Mật khẩu.',
        },
        { status: 400 },
      )
    }

    // 2. Validate định dạng Email & SĐT
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json<RegisterResponse>(
        {
          success: false,
          message: 'Định dạng email không hợp lệ.',
        },
        { status: 400 },
      )
    }

    if (body.userType === 'student' && !body.studentId) {
      return NextResponse.json<RegisterResponse>(
        {
          success: false,
          message: 'Đối tượng sinh viên bắt buộc phải cung cấp Mã sinh viên ICTU.',
        },
        { status: 400 },
      )
    }

    // 3. Mock thành công (Backend thay bằng logic INSERT vào DB)
    const mockUser = {
      id: `usr_${Date.now().toString(36)}`,
      fullName: body.fullName.trim(),
      email: body.email.toLowerCase().trim(),
      phoneNumber: body.phoneNumber.trim(),
      userType: body.userType,
      studentId: body.studentId?.toUpperCase().trim(),
      discountApproved: body.userType === 'student', // Đăng ký HSSV được duyệt sơ bộ
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json<RegisterResponse>(
      {
        success: true,
        message: body.userType === 'student'
          ? 'Đăng ký tài khoản Sinh viên ICTU thành công! Bạn được kích hoạt mức giá ưu đãi HSSV giảm 50%.'
          : 'Đăng ký tài khoản hành khách ICTU Transit thành công!',
        userId: mockUser.id,
        data: mockUser,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('API Register Error:', error)
    return NextResponse.json<RegisterResponse>(
      {
        success: false,
        message: 'Lỗi máy chủ nội bộ khi xử lý đăng ký.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
