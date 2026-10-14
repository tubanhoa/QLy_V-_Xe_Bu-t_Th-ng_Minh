/**
 * Feature: Authentication & Authorization
 * Đăng nhập đa vai trò (Admin, Dispatcher, Driver, Passenger), đăng ký & phiên làm việc
 * Ánh xạ Backend Module: backend/src/modules/auth
 */
export { LoginForm } from '@/components/login/login-form';
export { LoginPage } from '@/components/login/login-page';
export { RegisterForm } from '@/components/auth/register-form';
export { AuthPromptModal } from '@/components/auth/auth-prompt-modal';
export { authService } from '@/lib/services/auth.service';
export { useAuth } from '@/lib/auth-context';
