-- Migration 002: Bổ sung bảng positions + các cột vị trí/người giao việc/báo cáo cho
-- Chạy file này trên Supabase SQL Editor NẾU database đã tồn tại từ trước (KHÔNG xoá dữ liệu cũ).
-- Nếu là cài đặt mới hoàn toàn, chỉ cần chạy db/schema.sql (đã bao gồm sẵn nội dung này).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS position_id TEXT REFERENCES positions(id);

ALTER TABLE work_items ADD COLUMN IF NOT EXISTS assigned_by_id TEXT REFERENCES users(id);
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS report_to_id TEXT REFERENCES users(id);
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS position_id TEXT REFERENCES positions(id);

CREATE INDEX IF NOT EXISTS idx_work_items_department ON work_items(department_id);
CREATE INDEX IF NOT EXISTS idx_work_items_position ON work_items(position_id);

-- Dữ liệu mặc định cho danh sách vị trí (theo yêu cầu công ty)
INSERT INTO positions (id, name, sort_order) VALUES
  (gen_random_uuid()::text, 'Trưởng phòng', 1),
  (gen_random_uuid()::text, 'Phó phòng SX', 2),
  (gen_random_uuid()::text, 'Phó phòng gián tiếp', 3),
  (gen_random_uuid()::text, 'Trưởng nhóm nhận hàng', 4),
  (gen_random_uuid()::text, 'Trưởng nhóm nhặt lệnh', 5),
  (gen_random_uuid()::text, 'Trưởng nhóm giao hàng', 6),
  (gen_random_uuid()::text, 'Trưởng nhóm đóng gói HT trong PS', 7),
  (gen_random_uuid()::text, 'Trưởng nhóm đóng gói HT ngoài PS', 8),
  (gen_random_uuid()::text, 'Trưởng nhóm đóng gói Unit', 9),
  (gen_random_uuid()::text, 'Trưởng nhóm kế hoạch phòng', 10),
  (gen_random_uuid()::text, 'Trưởng nhóm giám sát', 11),
  (gen_random_uuid()::text, 'Trưởng nhóm hành chính', 12),
  (gen_random_uuid()::text, 'Nhân viên kế hoạch sản xuất', 13),
  (gen_random_uuid()::text, 'Nhân viên giám sát', 14),
  (gen_random_uuid()::text, 'Nhân viên hành chính', 15),
  (gen_random_uuid()::text, 'Nhân viên hỗ trợ', 16)
ON CONFLICT (name) DO NOTHING;
