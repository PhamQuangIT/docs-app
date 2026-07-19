-- Migration 003: Tái cấu trúc theo yêu cầu mới (file Thay_đổi.docx)
-- Chạy trên Supabase SQL Editor. AN TOÀN với dữ liệu users/work_items đã có
-- (chỉ gỡ tham chiếu department/position cũ về NULL trước khi xoá, không xoá user/work item).
--
-- QUAN TRỌNG: Nếu công ty đã gán department_id/position_id thật cho user/work item
-- theo danh sách CŨ, các tham chiếu đó sẽ bị đưa về NULL (chưa phân loại) sau migration này,
-- vì danh sách cũ bị xoá hoàn toàn theo đúng yêu cầu "xoá hết, thay bằng danh sách mới".
-- Sau khi chạy xong, cần vào từng user / work item để gán lại theo Bộ phận/Vị trí mới.

BEGIN;

-- ============================================================
-- 1. BỘ PHẬN / NHÓM - xoá hết danh sách cũ, thay bằng cấu trúc phân cấp mới
-- ============================================================

-- Gỡ tham chiếu cũ về NULL trước khi xoá (để không vỡ khoá ngoại)
UPDATE users SET department_id = NULL WHERE department_id IS NOT NULL;
UPDATE work_items SET department_id = NULL WHERE department_id IS NOT NULL;

DELETE FROM departments;

-- Bộ phận cha
INSERT INTO departments (id, name, parent_id) VALUES
  ('dept-gian-tiep', 'Bộ phận gián tiếp', NULL),
  ('dept-san-xuat', 'Bộ phận sản xuất', NULL);

-- Nhóm con của Bộ phận gián tiếp
INSERT INTO departments (id, name, parent_id) VALUES
  ('dept-hanh-chinh', 'Hành chính', 'dept-gian-tiep'),
  ('dept-ke-hoach', 'Kế hoạch', 'dept-gian-tiep'),
  ('dept-giam-sat', 'Giám sát', 'dept-gian-tiep');

-- Nhóm con của Bộ phận sản xuất
INSERT INTO departments (id, name, parent_id) VALUES
  ('dept-dong-goi-trong-ps', 'Đóng gói hệ thống trong phòng sạch', 'dept-san-xuat'),
  ('dept-dong-goi-ngoai-ps', 'Đóng gói hệ thống ngoài phòng sạch', 'dept-san-xuat'),
  ('dept-dong-goi-unit', 'Đóng gói Unit', 'dept-san-xuat'),
  ('dept-nhan-hang', 'Nhận hàng', 'dept-san-xuat'),
  ('dept-nhat-hang', 'Nhặt hàng', 'dept-san-xuat'),
  ('dept-giao-hang', 'Giao hàng', 'dept-san-xuat');

-- ============================================================
-- 2. VỊ TRÍ (CHỨC DANH) - xoá hết danh sách cũ, thay bằng danh sách mới
--    13 chức danh + "Khác" (dùng khi Thêm người dùng)
--    + "Khách hàng" (chỉ dùng cho lựa chọn "Báo cáo cho", ẩn khỏi form Thêm người dùng)
-- ============================================================

-- Gỡ tham chiếu cũ về NULL trước khi xoá
UPDATE users SET position_id = NULL WHERE position_id IS NOT NULL;
UPDATE work_items SET position_id = NULL WHERE position_id IS NOT NULL;
UPDATE work_items SET report_to_id = NULL WHERE report_to_id IS NOT NULL;

DELETE FROM positions;

INSERT INTO positions (id, name, sort_order) VALUES
  ('pos-giam-doc', 'Giám đốc/TL giám đốc', 1),
  ('pos-truong-phong', 'Trưởng phòng', 2),
  ('pos-pho-phong-gian-tiep', 'Phó phòng gián tiếp', 3),
  ('pos-pho-phong-san-xuat', 'Phó phòng sản xuất', 4),
  ('pos-tn-nhan-hang', 'Trưởng nhóm nhận hàng', 5),
  ('pos-tn-nhat-hang', 'Trưởng nhóm nhặt hàng', 6),
  ('pos-tn-giao-hang', 'Trưởng nhóm giao hàng', 7),
  ('pos-tn-dg-trong-ps', 'Trưởng nhóm đóng gói hệ thống trong phòng sạch', 8),
  ('pos-tn-dg-ngoai-ps', 'Trưởng nhóm đóng gói hệ thống ngoài phòng sạch', 9),
  ('pos-tn-dg-unit', 'Trưởng nhóm đóng gói Unit', 10),
  ('pos-tn-ke-hoach', 'Trưởng nhóm kế hoạch phòng', 11),
  ('pos-tn-hanh-chinh', 'Trưởng nhóm hành chính', 12),
  ('pos-tn-giam-sat', 'Trưởng nhóm giám sát', 13),
  ('pos-khac', 'Khác', 14),
  ('pos-khach-hang', 'Khách hàng', 99);

-- ============================================================
-- 3. work_items.report_to_id: đổi tham chiếu từ users(id) sang positions(id)
-- ============================================================

ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_report_to_id_fkey;
ALTER TABLE work_items ADD CONSTRAINT work_items_report_to_id_fkey
  FOREIGN KEY (report_to_id) REFERENCES positions(id);

-- ============================================================
-- 4. BẢNG TIN NỘI BỘ (mới) - ai cũng tạo được, ai cũng thấy, bắt buộc xác nhận đã đọc
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id);

COMMIT;

-- Sau khi chạy xong, vào trang "Người dùng" và các Work Item để gán lại
-- Bộ phận/Vị trí mới cho từng người (vì danh sách cũ đã bị xoá theo yêu cầu).
