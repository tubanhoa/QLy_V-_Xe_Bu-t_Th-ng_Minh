/**
 * Feature: Feedback & Complaints Management
 * Đánh giá chất lượng chuyến đi 1-5 sao & gửi khiếu nại kèm ảnh minh chứng
 * Ánh xạ Backend Module: backend/src/modules/feedback
 */
export { FeedbackModal } from '@/components/portal/feedback-modal';
export { AdminFeedback } from '@/components/portal/modules/admin-feedback';
export { feedbackService } from '@/lib/services/feedback.service';
export type {
  FeedbackItem,
  GetFeedbackResponse,
  FeedbackStats,
  CreateFeedbackPayload,
  CreateComplaintPayload,
  RespondFeedbackPayload,
} from '@/lib/services/feedback.service';
