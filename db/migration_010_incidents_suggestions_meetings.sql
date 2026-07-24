-- Migration 010: Báo cáo sự cố, Kiến nghị/Đề xuất, Lịch họp, hạ tầng gửi email (Master Prompt 23/07/2026)

-- ============================================================
-- 0) Notifications: thêm link_url tổng quát (không chỉ work_item_id) để dùng chung cho 3 phân hệ mới
-- ============================================================
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_url TEXT;

-- ============================================================
-- 1) BÁO CÁO SỰ CỐ - luồng duyệt: Trưởng nhóm -> Phó phòng -> Trưởng phòng -> Giám đốc/Trợ lý GĐ
-- ============================================================
CREATE TABLE IF NOT EXISTS incident_reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('light', 'medium', 'serious', 'critical')),
  root_cause TEXT,
  capa TEXT, -- Đối sách khắc phục
  capa_deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending_team_lead' CHECK (status IN (
    'pending_team_lead', 'pending_deputy', 'pending_department_head', 'pending_director',
    'approved', 'rejected', 'cancelled'
  )),
  creator_id TEXT NOT NULL REFERENCES users(id),
  department_id TEXT REFERENCES departments(id),
  reject_reason TEXT,
  generated_task_id TEXT REFERENCES work_items(id), -- Task khắc phục tự sinh khi duyệt cuối
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_creator ON incident_reports(creator_id);

CREATE TABLE IF NOT EXISTS incident_report_history (
  id TEXT PRIMARY KEY,
  incident_report_id TEXT NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_report_attachments (
  id TEXT PRIMARY KEY,
  incident_report_id TEXT NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2) KIẾN NGHỊ / ĐỀ XUẤT - luồng 2 chiều, người tạo tự chọn người nhận (hỗ trợ vượt cấp)
-- ============================================================
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  reason TEXT NOT NULL,
  desired_deadline TIMESTAMPTZ NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id),
  recipient_id TEXT NOT NULL REFERENCES users(id),
  -- 7 trạng thái phản hồi của cấp trên + 'pending' (chờ phản hồi) làm trạng thái khởi tạo
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'rejected', 'approved', 'partially_approved', 'need_more_info',
    'escalated', 'done', 'noted_for_future'
  )),
  reject_reason TEXT,
  partial_note TEXT,
  response_note TEXT, -- dùng cho "Yêu cầu bổ sung thông tin" / các ghi chú phản hồi khác
  responded_by TEXT REFERENCES users(id),
  responded_at TIMESTAMPTZ,
  locked_for_edit BOOLEAN NOT NULL DEFAULT FALSE, -- true khi approved/partially_approved/done
  edit_unlocked BOOLEAN NOT NULL DEFAULT FALSE, -- true sau khi cấp trên duyệt "Đề xuất sửa kiến nghị", tới lần sửa kế tiếp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_recipient ON suggestions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_creator ON suggestions(creator_id);

CREATE TABLE IF NOT EXISTS suggestion_edit_requests (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suggestion_history (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3) LỊCH HỌP
-- ============================================================
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN (
    'team', 'production_direct', 'production_indirect', 'department', 'board'
  )),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT, -- địa điểm hoặc link họp online
  agenda TEXT,
  host_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'rescheduled', 'cancelled')),
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time);

CREATE TABLE IF NOT EXISTS meeting_attendees (
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (meeting_id, user_id)
);

CREATE TABLE IF NOT EXISTS meeting_history (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created' | 'rescheduled' | 'cancelled'
  actor_id TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4) Hạ tầng gửi email (Resend) - log lại để dễ chẩn đoán khi gửi lỗi
-- ============================================================
CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  to_emails TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL, -- 'meeting_invite' | 'meeting_reschedule' | 'meeting_cancel' | 'test'
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT,
  related_meeting_id TEXT REFERENCES meetings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
