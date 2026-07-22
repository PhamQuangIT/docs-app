-- Chỉ ĐỌC dữ liệu, không sửa gì - dùng để chẩn đoán vì sao không đăng nhập được
SELECT
  u.id,
  u.email,
  u.full_name,
  u.is_active,
  r.name AS role_name,
  u.created_at,
  u.updated_at,
  length(u.password_hash) AS password_hash_length,
  left(u.password_hash, 7) AS password_hash_prefix  -- chỉ để xác nhận có phải hash bcrypt hợp lệ (phải bắt đầu $2a$/$2b$)
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE u.email ILIKE '%admin%' OR r.name IN ('BGĐ', 'Admin')
ORDER BY u.created_at ASC;

-- Đếm tổng số user hiện có trong hệ thống (để chắc chắn dữ liệu không bị xóa sạch)
SELECT COUNT(*) AS total_users FROM users;
SELECT COUNT(*) AS total_work_items FROM work_items;
