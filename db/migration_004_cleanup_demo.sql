-- Migration 004: Theo file Thay_đổi.docx (đợt 2) + yêu cầu bổ sung xoá thêm Phạm Quang
-- Chạy trên Supabase SQL Editor.
--
-- 1. Xoá VĨNH VIỄN 7 tài khoản demo (theo yêu cầu, không giữ lịch sử demo).
--    GIỮ LẠI admin@3pl.local (Quản trị hệ thống) làm tài khoản Admin dự phòng.
-- 2. Thêm cột work_items.owner_name_manual - cho phép nhập tay tên người chịu trách
--    nhiệm ngay lúc tạo việc (không gắn với tài khoản nào, không kích hoạt My Task/
--    Gán cho tôi/thông báo tự động cho ô này - phải dùng nút "Gán việc" ở trang chi
--    tiết nếu muốn các tính năng đó hoạt động).
-- 3. Đưa "Khách hàng" lên đầu danh sách trong lựa chọn "Báo cáo cho".
--
-- AN TOÀN: Chỉ xoá đúng 7 tài khoản demo liệt kê dưới đây (theo email), không đụng
-- tới admin@3pl.local hay bất kỳ tài khoản thật nào khác đã được tạo qua trang
-- Quản lý người dùng. Mọi work item/comment/lịch sử do CHÍNH 7 tài khoản demo này
-- tạo ra sẽ bị xoá theo (đúng yêu cầu "không có lịch sử thật cần giữ"). Các work
-- item do tài khoản KHÁC tạo, chỉ đang được các tài khoản demo này xử lý/gán, sẽ
-- được GIỮ LẠI và tự động gỡ về "chưa gán".
--
-- ⚠️ LƯU Ý: Sau migration này, admin@3pl.local là tài khoản DUY NHẤT còn lại trong
-- hệ thống. Hãy đăng nhập ngay và tạo tài khoản Admin/OM thật (email công ty) trước
-- khi đưa hệ thống vào dùng chính thức, để không phụ thuộc vào tài khoản demo còn sót.

BEGIN;

-- ============================================================
-- 1. Thêm cột nhập tay (không phá dữ liệu cũ)
-- ============================================================
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS owner_name_manual TEXT;

-- ============================================================
-- 2. Đưa "Khách hàng" lên đầu danh sách Báo cáo cho
-- ============================================================
UPDATE positions SET sort_order = 0 WHERE name = 'Khách hàng';

-- ============================================================
-- 3. Xoá vĩnh viễn 7 tài khoản demo
-- ============================================================
DO $$
DECLARE
  demo_emails TEXT[] := ARRAY[
    'sup.picking@3pl.local',
    'viewer@customer.local',
    'leader.packing@3pl.local',
    'leader.receiving@3pl.local',
    'nva@3pl.local',
    'ttb@3pl.local',
    'quang.pham@3pl.local'
  ];
  demo_ids TEXT[];
BEGIN
  SELECT array_agg(id) INTO demo_ids FROM users WHERE email = ANY(demo_emails);

  IF demo_ids IS NULL THEN
    RAISE NOTICE 'Không tìm thấy tài khoản demo nào (có thể đã xoá trước đó).';
  ELSE
    -- Gỡ tham chiếu owner/assigned_by trên các work item KHÔNG do demo user tạo
    -- (giữ lại work item đó, chỉ đưa về "chưa gán")
    UPDATE work_items SET owner_id = NULL
      WHERE owner_id = ANY(demo_ids) AND NOT (creator_id = ANY(demo_ids));
    UPDATE work_items SET assigned_by_id = NULL
      WHERE assigned_by_id = ANY(demo_ids) AND NOT (creator_id = ANY(demo_ids));

    -- Xoá escalation liên quan tới demo user (kể cả trên work item không do demo tạo)
    DELETE FROM escalations WHERE escalated_from = ANY(demo_ids) OR escalated_to = ANY(demo_ids);

    -- Xoá comment/history do demo user tạo trên work item của người khác
    DELETE FROM work_item_comments WHERE user_id = ANY(demo_ids);
    DELETE FROM work_item_history WHERE changed_by = ANY(demo_ids);
    DELETE FROM work_item_attachments WHERE uploaded_by = ANY(demo_ids);

    -- Xoá notification liên quan (theo người nhận LÀ demo, hoặc liên quan tới
    -- work item mà demo tạo ra - vì người NHẬN thông báo có thể là tài khoản thật
    -- không nằm trong danh sách demo_ids, nhưng work_item đó sắp bị xoá)
    DELETE FROM notifications WHERE user_id = ANY(demo_ids);
    DELETE FROM notifications WHERE work_item_id IN (
      SELECT id FROM work_items WHERE creator_id = ANY(demo_ids)
    );

    -- Xoá bảng tin do demo user tạo (và các lượt đọc liên quan)
    DELETE FROM announcement_reads WHERE user_id = ANY(demo_ids);
    DELETE FROM announcements WHERE created_by = ANY(demo_ids);

    -- Xoá toàn bộ work item DO demo user tạo (cascade tự xoá comment/history/attachment/escalation của item đó)
    DELETE FROM work_items WHERE creator_id = ANY(demo_ids);

    -- Cuối cùng xoá tài khoản demo
    DELETE FROM users WHERE id = ANY(demo_ids);

    RAISE NOTICE 'Đã xoá % tài khoản demo.', array_length(demo_ids, 1);
  END IF;
END $$;

COMMIT;
