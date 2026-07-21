-- Migration 005: Theo file Thay_đổi.docx (đợt 3)
-- Chạy trên Supabase SQL Editor.
--
-- 1. Thêm 2 bộ phận mới ngang hàng: "Ban giám đốc", "Phòng dịch vụ khách hàng".
-- 2. Chuyển đổi hệ Vai trò cũ (Admin/Operation Manager/Leader/Supervisor/Employee/Viewer)
--    sang hệ Vai trò mới (BGĐ/Quản lý/Sản xuất trực tiếp/Gián tiếp/Khách hàng):
--      Admin, Operation Manager  -> BGĐ
--      Leader, Supervisor        -> Quản lý
--      Viewer                    -> Khách hàng
--      Employee (thuộc Bộ phận sản xuất hoặc nhóm con của nó) -> Sản xuất trực tiếp
--      Employee (còn lại)        -> Gián tiếp
--    TOÀN BỘ tài khoản được GIỮ NGUYÊN, chỉ đổi role_id - không xoá user nào.
-- 3. Cột work_items.owner_name_manual, report_to_id (positions)... đã có từ trước, không đổi.
--
-- AN TOÀN: Không xoá bất kỳ user/work_item nào. Chỉ đổi role_id của user theo bảng
-- ánh xạ ở trên, sau đó xoá 6 role CŨ (không còn ai dùng nữa).

BEGIN;

-- ============================================================
-- 1. Thêm 2 bộ phận mới (ngang hàng với Bộ phận gián tiếp / Bộ phận sản xuất)
-- ============================================================
INSERT INTO departments (id, name, parent_id)
SELECT 'dept-bgd', 'Ban giám đốc', NULL
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Ban giám đốc');

INSERT INTO departments (id, name, parent_id)
SELECT 'dept-cs', 'Phòng dịch vụ khách hàng', NULL
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Phòng dịch vụ khách hàng');

-- ============================================================
-- 2. Tạo 5 vai trò mới (nếu chưa có)
-- ============================================================
INSERT INTO roles (id, name, permissions)
SELECT 'role-bgd', 'BGĐ', '{"all":true}'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'BGĐ');

INSERT INTO roles (id, name, permissions)
SELECT 'role-quanly', 'Quản lý', '{"assign":true,"close":true,"report_team":true}'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Quản lý');

INSERT INTO roles (id, name, permissions)
SELECT 'role-sxtt', 'Sản xuất trực tiếp', '{"update_own":true}'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Sản xuất trực tiếp');

INSERT INTO roles (id, name, permissions)
SELECT 'role-giantiep', 'Gián tiếp', '{"update_own":true}'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Gián tiếp');

INSERT INTO roles (id, name, permissions)
SELECT 'role-khachhang', 'Khách hàng', '{"view_only":true,"create_customer_request":true}'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Khách hàng');

-- ============================================================
-- 3. Chuyển toàn bộ user sang vai trò mới tương ứng
-- ============================================================
DO $$
DECLARE
  id_bgd TEXT := (SELECT id FROM roles WHERE name = 'BGĐ');
  id_quanly TEXT := (SELECT id FROM roles WHERE name = 'Quản lý');
  id_sxtt TEXT := (SELECT id FROM roles WHERE name = 'Sản xuất trực tiếp');
  id_giantiep TEXT := (SELECT id FROM roles WHERE name = 'Gián tiếp');
  id_khachhang TEXT := (SELECT id FROM roles WHERE name = 'Khách hàng');
  id_dept_sx TEXT := (SELECT id FROM departments WHERE name = 'Bộ phận sản xuất');
BEGIN
  -- Admin, Operation Manager -> BGĐ
  UPDATE users SET role_id = id_bgd
  WHERE role_id IN (SELECT id FROM roles WHERE name IN ('Admin', 'Operation Manager'));

  -- Leader, Supervisor -> Quản lý
  UPDATE users SET role_id = id_quanly
  WHERE role_id IN (SELECT id FROM roles WHERE name IN ('Leader', 'Supervisor'));

  -- Viewer -> Khách hàng
  UPDATE users SET role_id = id_khachhang
  WHERE role_id IN (SELECT id FROM roles WHERE name = 'Viewer');

  -- Employee thuộc Bộ phận sản xuất (hoặc nhóm con) -> Sản xuất trực tiếp
  UPDATE users SET role_id = id_sxtt
  WHERE role_id IN (SELECT id FROM roles WHERE name = 'Employee')
    AND (department_id = id_dept_sx OR department_id IN (
      SELECT id FROM departments WHERE parent_id = id_dept_sx
    ));

  -- Employee còn lại -> Gián tiếp
  UPDATE users SET role_id = id_giantiep
  WHERE role_id IN (SELECT id FROM roles WHERE name = 'Employee');

  RAISE NOTICE 'Đã chuyển đổi toàn bộ user sang hệ vai trò mới.';
END $$;

-- ============================================================
-- 4. Xoá 6 vai trò cũ (không còn user nào tham chiếu sau bước 3)
-- ============================================================
DELETE FROM roles WHERE name IN ('Admin', 'Operation Manager', 'Leader', 'Supervisor', 'Employee', 'Viewer');

COMMIT;

-- Kiểm tra sau khi chạy: vào Table Editor -> users -> xem cột role_id đã map đúng
-- vai trò mới chưa (join sang bảng roles để xem tên).
