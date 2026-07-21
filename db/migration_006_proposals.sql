-- Migration 006: Theo file Thay_đổi.docx (đợt 4) - cơ chế "Đề xuất"
-- Chạy trên Supabase SQL Editor.
--
-- Thêm bảng work_item_proposals: người được giao việc (owner) đề xuất Hoàn thành/Hủy/
-- Sửa nội dung-hạn, gửi cho người giao việc (assigned_by_id) duyệt trước khi có hiệu lực.
-- KHÔNG xoá/đổi dữ liệu hiện có - chỉ thêm bảng mới, an toàn tuyệt đối.

BEGIN;

CREATE TABLE IF NOT EXISTS work_item_proposals (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('complete','cancel','edit')),
  proposed_by TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  proposed_title TEXT,
  proposed_description TEXT,
  proposed_deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_work_item ON work_item_proposals(work_item_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON work_item_proposals(status);

COMMIT;
