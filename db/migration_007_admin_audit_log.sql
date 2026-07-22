-- Migration 007: Audit log cho hành động quản trị (mục 12 Thay_đổi.docx - Reset Password)
-- Chạy 1 lần nếu đang cập nhật từ bản deploy cũ hơn.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,                 -- vd: 'reset_password'
  actor_id TEXT NOT NULL REFERENCES users(id),      -- người thực hiện (Admin)
  target_user_id TEXT NOT NULL REFERENCES users(id), -- tài khoản bị thay đổi
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log(actor_id);
