# Daily Operation Control System (DOCS) — MVP

Ứng dụng quản lý phát sinh vận hành hàng ngày cho 3PL Onsite, đúng theo tài liệu
`SRS_SDD_Daily_Operation_System.md`. Đã code theo đúng thứ tự ưu tiên trong Phụ lục:

1. **DB** — `db/schema.sql` (PostgreSQL, chạy tốt trên Supabase Free tier)
2. **API** — toàn bộ REST API tại `src/app/api/**`
3. **Dashboard / Work Item** — `src/app/dashboard`, `src/app/work-items`
4. **Notification / Cron** — `src/app/api/notifications`, `src/app/api/cron/check-overdue`
5. **Report** — `src/app/reports` + xuất Excel `src/app/api/reports/export`

**Muốn nhiều người dùng cùng truy cập, kể cả từ ngoài mạng công ty?**
→ Xem file **`DEPLOY.md`** — hướng dẫn deploy lên **Vercel + Supabase** hoặc **Netlify + Supabase**
(miễn phí, ~20-30 phút, đã có sẵn cấu hình cho cả 2 nền tảng: `vercel.json` và `netlify.toml`).

## Tính năng đã bổ sung theo yêu cầu sử dụng thực tế

- Nút **"Gán cho tôi"** khi xem việc chưa có người xử lý
- **Đếm ngược SLA** ngay trên từng dòng việc (VD: "Còn 45 phút", "Quá hạn 1 giờ")
- **Đánh dấu tất cả đã đọc** ở Thông báo
- Nút **"+ Tạo việc" nổi cố định**, hiện ở mọi trang
- **Dashboard tự động làm mới mỗi 60 giây**
- **Ghi nhớ bộ lọc** (loại, trạng thái, bộ phận, vị trí) khi quay lại trang danh sách
- Admin có thể **vô hiệu hoá tài khoản** (giữ nguyên lịch sử công việc liên quan, không xoá cứng để tránh vỡ dữ liệu)
- Mọi tài khoản có thể **tự đổi mật khẩu** (trang `/change-password`)
- Work item có thêm: **Vị trí chịu trách nhiệm**, **Người giao việc** (tự ghi nhận khi gán), **Báo cáo cho**
- Bộ lọc danh sách việc theo **bộ phận/nhóm, vị trí, tên người**
- Danh mục **16 vị trí công việc mặc định** (Trưởng phòng, Phó phòng SX, các Trưởng nhóm, Nhân viên...) — quản lý tại bảng `positions`, gán cho user trong trang Quản lý người dùng
- Nếu đang cập nhật từ bản deploy cũ, xem mục **"Đã deploy từ trước"** trong `DEPLOY.md` để chạy migration đúng cách (không mất dữ liệu)

## Chạy thử trên máy cá nhân (development)

Cần cài sẵn PostgreSQL (hoặc dùng luôn connection string Supabase từ `DEPLOY.md` Bước 1–2).

```bash
npm install

# Tạo file .env với connection string PostgreSQL của bạn:
# DATABASE_URL="postgresql://user:password@localhost:5432/docs_app"
# JWT_SECRET="bat-ky-chuoi-ngau-nhien-nao"

# Áp schema vào DB (chỉ cần làm 1 lần):
psql "$DATABASE_URL" -f db/schema.sql

npm run seed   # tạo dữ liệu mẫu: roles, departments, users, SLA, vài work item
npm run dev    # chạy dev server tại http://localhost:3000
```

Tài khoản đăng nhập mẫu (xem thêm trong `db/seed.ts`):

| Email | Mật khẩu | Vai trò |
|---|---|---|
| admin@3pl.local | Admin@123 | Admin |
| quang.pham@3pl.local | Quang@123 | Operation Manager |
| leader.receiving@3pl.local | Leader@123 | Leader |
| sup.picking@3pl.local | Sup@123 | Supervisor |
| nva@3pl.local | Emp@123 | Employee |
| viewer@customer.local | Viewer@123 | Viewer (khách hàng) |

## Cấu trúc thư mục

```
db/schema.sql              # DB schema PostgreSQL (mục 17 SDD)
db/seed.ts                  # Dữ liệu mẫu
src/lib/db.ts               # Kết nối PostgreSQL (pg Pool) + helper query all/get/run
src/lib/auth.ts              # Session JWT + cookie, kiểm tra quyền
src/lib/workflow.ts          # Bảng chuyển trạng thái hợp lệ (mục 16)
src/lib/notify.ts            # Helper tạo notification
src/lib/cron-logic.ts        # Logic đánh dấu overdue / cảnh báo gần hạn / auto-escalate
src/app/api/**               # REST API (mục 18 SDD)
src/app/dashboard             # Dashboard (mục 6, 21)
src/app/work-items            # Danh sách + tạo nhanh (≤30s)
src/app/work-items/[id]        # Chi tiết: assign, đổi trạng thái, comment, escalate, lịch sử
src/app/my-task                # Việc của riêng user đăng nhập
src/app/notifications           # Trung tâm thông báo
src/app/reports                 # Báo cáo tổng hợp + xuất Excel
src/app/users                    # Quản lý user (Admin)
scripts/check-overdue.ts         # Chạy cron độc lập qua crontab nếu tự host (không dùng Vercel)
vercel.json                       # Cấu hình Vercel Cron gọi /api/cron/check-overdue mỗi 5 phút
DEPLOY.md                          # Hướng dẫn deploy Vercel + Supabase từng bước
```

## Cron kiểm tra quá hạn

- **Deploy Vercel:** `vercel.json` đã cấu hình cron gọi `/api/cron/check-overdue` mỗi 5 phút tự động.
- **Tự host (VPS):** chạy `npm run cron:overdue` qua `crontab -e`:
  ```
  */5 * * * * cd /path/to/docs-app && npm run cron:overdue >> /var/log/docs-cron.log 2>&1
  ```

## Việc còn lại trước khi lên production thật

- [ ] Đổi toàn bộ mật khẩu mẫu trước khi cấp cho nhân viên thật.
- [ ] Thêm gửi email thật (Resend/SendGrid) trong `src/lib/notify.ts` — hiện tại chỉ ghi vào bảng `notifications` (in-app).
- [ ] Thêm upload file đính kèm thật (Supabase Storage) — bảng `work_item_attachments` đã có sẵn, chỉ thiếu UI upload.
- [ ] Trang Calendar View, Setting (SLA config UI), Department management UI — đã có API, chưa có UI (không nằm trong 5 bước ưu tiên ban đầu, làm ở vòng sau).
