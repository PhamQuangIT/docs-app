-- Migration 008: Cấu trúc lại vòng đời công việc + vai trò theo từng việc (theo Thay_đổi.docx 21/07/2026)
-- SỬA LỖI so với bản chạy trước: phải DROP CONSTRAINT cũ TRƯỚC khi UPDATE dữ liệu sang giá trị status mới,
-- nếu không constraint cũ (chưa biết 'draft'/'pending_acceptance'...) sẽ chặn ngay các câu UPDATE bên dưới
-- (đây chính là lỗi 23514 "violates check constraint work_items_status_check" anh gặp).
-- Chạy 1 lần, theo đúng thứ tự bên dưới. KHÔNG mất dữ liệu (trạng thái cũ được map sang trạng thái mới).

-- 1) Bảng "Người phối hợp" (mới) - quan hệ nhiều-nhiều, khác với "Người chịu trách nhiệm chính" (owner_id, vẫn 1-1)
CREATE TABLE IF NOT EXISTS work_item_coordinators (
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (work_item_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_work_item_coordinators_user ON work_item_coordinators(user_id);

-- 2) GỠ constraint status CŨ TRƯỚC (để các câu UPDATE bên dưới không bị chặn)
ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_status_check;

-- 3) Map 7 trạng thái cũ -> 9 trạng thái mới (không mất dữ liệu)
--    new -> draft | assigned -> pending_acceptance | doing/waiting -> in_progress | completed/closed -> completed
UPDATE work_items SET status = 'draft' WHERE status = 'new';
UPDATE work_items SET status = 'pending_acceptance' WHERE status = 'assigned';
UPDATE work_items SET status = 'in_progress' WHERE status IN ('doing', 'waiting');
UPDATE work_items SET status = 'completed' WHERE status IN ('completed', 'closed');
-- 'cancelled' giữ nguyên, không đổi

-- 4) Thêm constraint status MỚI (chỉ sau khi toàn bộ dữ liệu đã hợp lệ với danh sách mới)
ALTER TABLE work_items ADD CONSTRAINT work_items_status_check
  CHECK (status IN (
    'draft', 'pending_acceptance', 'in_progress', 'pending_change_approval',
    'pending_completion_approval', 'rework_requested', 'acceptance_rejected',
    'completed', 'cancelled'
  ));

-- 5) Đề xuất: thêm loại 'reassign' (giao lại/đổi người) + cột người được đề xuất giao lại
ALTER TABLE work_item_proposals DROP CONSTRAINT IF EXISTS work_item_proposals_type_check;
ALTER TABLE work_item_proposals ADD CONSTRAINT work_item_proposals_type_check
  CHECK (type IN ('complete', 'cancel', 'edit', 'reassign'));
ALTER TABLE work_item_proposals ADD COLUMN IF NOT EXISTS proposed_owner_id TEXT REFERENCES users(id);

-- Lưu ý vận hành:
-- - "Người chịu trách nhiệm chính" (owner_id) từ nay BẮT BUỘC là 1 tài khoản có sẵn ngay khi tạo việc
--   (không còn kiểu nhập tay tự do owner_name_manual cho việc tạo mới). Cột owner_name_manual vẫn giữ lại
--   trong DB chỉ để hiển thị lịch sử các việc tạo trước migration này.
-- - Nút "Gán việc" độc lập ở trang chi tiết đã được thay bằng nút "Điều chỉnh phân công" (chỉ người giao việc/
--   cấp trên dùng để đổi người, có lý do, ghi lịch sử) - dùng lại API /assign nhưng đổi tên & bắt buộc lý do.
