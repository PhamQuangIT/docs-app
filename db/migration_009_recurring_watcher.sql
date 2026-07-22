-- Migration 009: Thời hạn định kỳ (recurring tasks) + Email theo dõi (watcher email) - Master Prompt 22/07/2026

ALTER TABLE work_items ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'once'
  CHECK (recurrence IN ('once', 'daily', 'weekly', 'monthly', 'yearly'));
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS recurrence_next_run TIMESTAMPTZ;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS recurrence_parent_id TEXT REFERENCES work_items(id);
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS watcher_email TEXT;

CREATE INDEX IF NOT EXISTS idx_work_items_recurrence_next_run ON work_items(recurrence_next_run) WHERE recurrence != 'once';

-- Lưu lại các email đã từng nhập ở "Email theo dõi" để gợi ý autocomplete cho lần sau (không gắn với 1 việc cụ thể)
CREATE TABLE IF NOT EXISTS known_watcher_emails (
  email TEXT PRIMARY KEY,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_count INT NOT NULL DEFAULT 1
);
