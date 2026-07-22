-- Daily Operation Control System - Database Schema (PostgreSQL / Supabase)

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  permissions TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_info TEXT
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role_id TEXT NOT NULL REFERENCES roles(id),
  department_id TEXT REFERENCES departments(id),
  position_id TEXT REFERENCES positions(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('issue','task','customer_request','meeting_action','management_task')),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low')),
  -- 9 trạng thái theo Thay_đổi.docx mục 6 (21/07/2026):
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_acceptance', 'in_progress', 'pending_change_approval',
    'pending_completion_approval', 'rework_requested', 'acceptance_rejected',
    'completed', 'cancelled'
  )),
  is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
  creator_id TEXT NOT NULL REFERENCES users(id),
  owner_id TEXT REFERENCES users(id), -- Người chịu trách nhiệm chính - bắt buộc chọn tài khoản ngay khi tạo việc
  owner_name_manual TEXT, -- chỉ còn dữ liệu lịch sử của các việc tạo trước mục 4 (đợt 5), không dùng cho việc mới
  assigned_by_id TEXT REFERENCES users(id), -- Người giao việc
  report_to_id TEXT REFERENCES positions(id), -- Báo cáo cho (theo chức danh, giữ nguyên theo quyết định đợt 4)
  department_id TEXT REFERENCES departments(id),
  position_id TEXT REFERENCES positions(id),
  customer_id TEXT REFERENCES customers(id),
  meeting_ref TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  waiting_reason TEXT,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Người phối hợp (mới, mục 3 + 4 Thay_đổi.docx) - nhiều-nhiều, khác owner_id (chỉ 1)
CREATE TABLE IF NOT EXISTS work_item_coordinators (
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (work_item_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_work_item_coordinators_user ON work_item_coordinators(user_id);

CREATE TABLE IF NOT EXISTS work_item_comments (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_item_attachments (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_item_history (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  escalated_from TEXT REFERENCES users(id),
  escalated_to TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  is_auto BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  work_item_id TEXT REFERENCES work_items(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_config (
  id TEXT PRIMARY KEY,
  priority TEXT NOT NULL CHECK (priority IN ('urgent','high','normal','low')),
  response_minutes INT NOT NULL,
  resolution_minutes INT NOT NULL,
  customer_id TEXT REFERENCES customers(id)
);

-- Bảng tin nội bộ - ai cũng tạo được, ai cũng thấy, bắt buộc xác nhận đã đọc
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, user_id)
);

-- Đề xuất của người được giao việc (hoàn thành / hủy / sửa nội dung-hạn),
-- gửi cho người giao việc duyệt trước khi có hiệu lực thật sự.
CREATE TABLE IF NOT EXISTS work_item_proposals (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('complete','cancel','edit','reassign')),
  proposed_by TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  proposed_title TEXT,
  proposed_description TEXT,
  proposed_deadline TIMESTAMPTZ,
  proposed_owner_id TEXT REFERENCES users(id), -- dùng cho type = 'reassign'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_work_item ON work_item_proposals(work_item_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON work_item_proposals(status);

-- Audit log cho hành động quản trị (vd: Admin reset mật khẩu người dùng khác) - mục 12 Thay_đổi.docx
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log(actor_id);

CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
CREATE INDEX IF NOT EXISTS idx_work_items_owner ON work_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_work_items_deadline ON work_items(deadline);
CREATE INDEX IF NOT EXISTS idx_work_items_type ON work_items(type);
CREATE INDEX IF NOT EXISTS idx_work_items_department ON work_items(department_id);
CREATE INDEX IF NOT EXISTS idx_work_items_position ON work_items(position_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id);
