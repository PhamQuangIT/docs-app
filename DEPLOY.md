# Hướng dẫn Deploy — Vercel + Supabase HOẶC Netlify + Supabase

Ước tính thời gian: 20–30 phút. Chi phí: **0đ** ở quy mô demo/pilot (Supabase Free +
Vercel/Netlify gói miễn phí). Khi dữ liệu lớn hơn free tier, nâng cấp thêm.

**Database luôn dùng Supabase (PostgreSQL) dù chọn Vercel hay Netlify** — 2 bước đầu
dưới đây làm chung, sau đó rẽ nhánh theo nơi anh muốn host phần web.

## ⚠️ Đã deploy từ trước — cần cập nhật database khi có phiên bản mới?

**Nguyên tắc quan trọng nhất: mỗi file migration chỉ chạy ĐÚNG 1 LẦN DUY NHẤT, khi
anh cập nhật lên đúng phiên bản đó. Không bao giờ chạy lại 1 file migration đã chạy
thành công trước đó** — chạy lại có thể xoá sạch dữ liệu vừa cập nhật và quay ngược
về trạng thái cũ hơn.

Dưới đây là toàn bộ lịch sử các file migration theo thứ tự thời gian. Chỉ chạy
**những file anh CHƯA TỪNG chạy**, theo đúng thứ tự từ trên xuống:

| File | Mô tả | Đã chạy chưa? |
|---|---|---|
| `db/migration_002_positions.sql` | Thêm bảng Vị trí, trường Người giao việc/Báo cáo cho | Nếu đã chạy → bỏ qua |
| `db/migration_003_reorg.sql` | Đổi Bộ phận thành phân cấp, Vị trí theo chức danh mới | Nếu đã chạy → bỏ qua |
| `db/migration_004_cleanup_demo.sql` | Xoá tài khoản demo, Người chịu trách nhiệm nhập tay | Nếu đã chạy → bỏ qua |
| `db/migration_005_new_roles.sql` | Đổi hệ Vai trò (BGĐ/Quản lý/Sản xuất trực tiếp/Gián tiếp/Khách hàng), thêm Ban giám đốc + Phòng DVKH | Nếu đã chạy → bỏ qua |
| `db/migration_006_proposals.sql` | Thêm cơ chế Đề xuất hoàn thành/hủy/sửa nội dung | Nếu đã chạy → bỏ qua |
| `db/migration_007_admin_audit_log.sql` | Thêm bảng `admin_audit_log` (audit reset mật khẩu) | Nếu đã chạy → bỏ qua |
| `db/migration_008_task_role_workflow.sql` | Đổi 7 trạng thái cũ sang 9 trạng thái mới, thêm `work_item_coordinators`, thêm loại đề xuất `reassign` | Nếu đã chạy → bỏ qua |
| `db/migration_009_recurring_watcher.sql` | Thêm Thời hạn định kỳ (`recurrence`), Email theo dõi (`watcher_email`), bảng `known_watcher_emails` | Nếu đã chạy → bỏ qua |
| `db/migration_010_incidents_suggestions_meetings.sql` | Thêm 3 phân hệ: Báo cáo sự cố, Kiến nghị/Đề xuất, Lịch họp + bảng `email_log` | Nếu đã chạy → bỏ qua |

**Cách xác định đã chạy file nào chưa:** vào Supabase → Table Editor → xem bảng
`positions` — nếu đã thấy danh sách chức danh (Trưởng phòng, Giám đốc/TL giám đốc...)
nghĩa là 002 và 003 đã chạy rồi. Xem bảng `users` — nếu chỉ còn `admin@3pl.local`
(không còn `quang.pham@3pl.local` hay các tài khoản `...@3pl.local` khác) nghĩa là
004 đã chạy rồi. Xem bảng `roles` — nếu thấy "BGĐ", "Quản lý", "Sản xuất trực tiếp"
(không còn "Admin", "Leader"...) nghĩa là 005 đã chạy rồi. Xem danh sách bảng (menu
Table Editor bên trái) — nếu thấy bảng `work_item_proposals` nghĩa là 006 đã chạy rồi.
Nếu thấy bảng `admin_audit_log` nghĩa là 007 đã chạy. Mở bảng `work_items`, xem cột
`status` — nếu giá trị đang là `draft`/`pending_acceptance`/`in_progress`... (9 trạng
thái mới) thay vì `new`/`assigned`/`doing` (cũ) nghĩa là 008 đã chạy. Nếu thấy cột
`recurrence`/`watcher_email` trong `work_items` nghĩa là 009 đã chạy. Nếu thấy các
bảng `incident_reports`, `suggestions`, `meetings` nghĩa là 010 đã chạy.

**Từ nay về sau**, mỗi khi tôi gửi thêm file `migration_00X_....sql` mới, anh chỉ cần
chạy **đúng file mới đó** (không đụng tới các file cũ hơn đã chạy), rồi đẩy code:
```bash
git add .
git commit -m "update"
git push
```

Nếu là cài đặt hoàn toàn mới (chưa từng deploy), bỏ qua toàn bộ mục này, làm theo
Bước 1 → 7 bên dưới bình thường (file `db/schema.sql` đã bao gồm sẵn mọi thứ mới nhất,
không cần chạy file migration nào cả).

## Bước 1 — Tạo project Supabase (database)

1. Vào https://supabase.com → **Sign up** (dùng Google hoặc GitHub cho nhanh)
2. **New Project** → đặt tên (VD: `docs-app`), chọn vùng **Singapore** (gần VN nhất) →
   đặt mật khẩu database (lưu lại, sẽ cần dùng)
3. Đợi ~2 phút để Supabase khởi tạo xong
4. Vào **Project Settings → Database → Connection string** → chọn tab **URI**
   (dùng **Connection pooling / Transaction mode**, cổng `6543`, phù hợp cho serverless)
5. Copy connection string, dạng:
   ```
   postgresql://postgres.xxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
   Thay `[YOUR-PASSWORD]` bằng mật khẩu đã đặt ở bước 2.

## Bước 2 — Áp dụng schema vào Supabase

1. Trong Supabase, vào **SQL Editor** (menu bên trái)
2. Mở file `db/schema.sql` trong source code, copy toàn bộ nội dung
3. Dán vào SQL Editor → bấm **Run**
4. Kiểm tra: vào **Table Editor**, phải thấy đủ 11 bảng (`users`, `work_items`, `roles`...)

## Bước 3 — Đưa code lên GitHub

1. Tạo repo mới (private) trên https://github.com/new
2. Trong thư mục `docs-app` trên máy, chạy:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<tai-khoan-cua-ban>/docs-app.git
   git push -u origin main
   ```

---

## Bước 4A — Deploy lên VERCEL (nếu chưa dùng Netlify sẵn)

1. Vào https://vercel.com → **Sign up** bằng GitHub
2. **Add New → Project** → chọn repo `docs-app` vừa push
3. Ở phần **Environment Variables**, thêm `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET` (xem bảng ở Bước 5)
4. Bấm **Deploy** → đợi ~2 phút
5. Cron quá hạn tự động chạy qua `vercel.json` có sẵn — không cần làm gì thêm.

## Bước 4B — Deploy lên NETLIFY (vì anh đã có sẵn phần mềm khác trên đó)

Dự án đã có sẵn `netlify.toml` + `netlify/functions/check-overdue.ts` — chỉ cần:

1. Vào https://app.netlify.com → **Add new site → Import an existing project**
2. Chọn GitHub → chọn repo `docs-app` vừa push
3. Netlify tự nhận diện Next.js (qua `@netlify/plugin-nextjs` đã khai báo trong
   `netlify.toml`), build command và publish directory đã cấu hình sẵn — **không cần
   sửa gì** ở phần build settings
4. Trước khi bấm Deploy, vào **Site settings → Environment variables**, thêm
   `DATABASE_URL` và `JWT_SECRET` (xem bảng ở Bước 5) — **bắt buộc phải thêm trước khi
   build lần đầu**, vì app sẽ lỗi build nếu thiếu `DATABASE_URL`
5. Bấm **Deploy site**

**Về cron kiểm tra quá hạn trên Netlify:** file `netlify/functions/check-overdue.ts`
là 1 Netlify Scheduled Function độc lập, tự chạy mỗi 5 phút một khi đã deploy —
Netlify tự nhận diện qua `schedule("*/5 * * * *", ...)` khai báo ngay trong code,
không cần cấu hình thêm ở đâu khác. Có thể xem lịch sử chạy tại **Netlify → Functions
→ check-overdue**.

> Lưu ý: `vercel.json` trong repo chỉ có tác dụng khi deploy lên Vercel, Netlify sẽ bỏ
> qua file này (không gây lỗi, chỉ đơn giản là không đọc tới). Ngược lại, nếu deploy
> lên Vercel thì thư mục `netlify/functions` cũng không được Vercel gọi tới — vô hại,
> để nguyên cả hai cho tiện nếu sau này đổi platform.

---

## Bước 5 — Biến môi trường cần thiết (áp dụng cho cả Vercel & Netlify)

| Key | Value |
|---|---|
| `DATABASE_URL` | connection string Supabase đã copy ở Bước 1 |
| `JWT_SECRET` | một chuỗi ngẫu nhiên bất kỳ, VD tự gõ 32 ký tự lộn xộn |
| `CRON_SECRET` | (chỉ cần nếu dùng Vercel) một chuỗi ngẫu nhiên khác để bảo vệ endpoint cron |

## Bước 6 — Tạo dữ liệu mẫu trên Supabase (chỉ 1 lần)

Từ máy tính cá nhân (đã cài Node.js), trong thư mục `docs-app`:
```bash
# Tạo file .env.local trỏ vào Supabase (KHÔNG commit file này lên Git)
echo 'DATABASE_URL="<connection-string-supabase>"' > .env.local
echo 'JWT_SECRET="<chuoi-random-giong-tren-vercel-hoac-netlify>"' >> .env.local
npm run seed
```
Lệnh này tạo tài khoản Admin/OM/Leader/... và vài công việc mẫu **trực tiếp trên
Supabase** — vì vậy chỉ nên chạy **một lần** (chạy lại sẽ xoá sạch dữ liệu hiện có,
xem kỹ `db/seed.ts` trước khi chạy trên dữ liệu thật).

> Với dữ liệu thật của công ty (danh sách nhân viên, phòng ban...), nên tạo qua giao diện
> **Quản lý người dùng** (`/users`, đăng nhập bằng tài khoản Admin) thay vì sửa seed script.

## Bước 7 — Truy cập

Vercel cấp URL dạng `https://docs-app-xxxx.vercel.app`, Netlify cấp URL dạng
`https://docs-app-xxxx.netlify.app` — gửi link này cho các Leader/Supervisor/nhân
viên liên quan, họ mở bằng trình duyệt điện thoại/máy tính, đăng nhập bằng tài khoản
được cấp là dùng được ngay, **không cần cài đặt gì thêm**, **không cần VPN**, dùng
được cả khi ở ngoài nhà máy.

Muốn có domain riêng (VD: `van-hanh.congty.vn`) → vào **Project/Site settings →
Domains** → làm theo hướng dẫn trỏ DNS (khoảng 10 phút, cần quyền chỉnh DNS của công ty).

## Cấp tài khoản cho nhân viên

Đăng nhập bằng tài khoản Admin (`admin@3pl.local` — **đổi mật khẩu ngay sau lần đăng
nhập đầu tiên** bằng cách sửa trực tiếp trong Supabase Table Editor, bảng `users`,
cột `password_hash`, hoặc yêu cầu tôi bổ sung màn hình "Đổi mật khẩu") → vào trang
**Người dùng** → **+ Thêm người dùng** để tạo tài khoản thật cho từng Leader/Supervisor/
nhân viên trong công ty.

## Những điều cần lưu ý khi vận hành thật

- **Đổi hết mật khẩu mẫu** (`Admin@123`, `Quang@123`...) trước khi đưa cho nhân viên dùng thật.
- Supabase Free tier: DB tạm dừng (pause) nếu không có hoạt động 7 ngày liên tục — chỉ ảnh
  hưởng nếu không ai dùng app cả tuần; nếu bị pause, vào Supabase bấm **Resume** là dùng lại được.
- Backup: Supabase tự động backup hàng ngày ở gói trả phí; gói Free không có backup tự động —
  nên định kỳ (VD hàng tuần) vào **Database → Backups** export thủ công nếu dữ liệu quan trọng.
- Nếu số lượng người dùng/công việc tăng nhiều (>500 việc/ngày, >50 người dùng đồng thời),
  nên nâng cấp Supabase lên gói Pro (~$25/tháng) để tránh giới hạn kết nối.
- **Netlify gói Free:** function timeout 10 giây/lần — đủ dùng cho quy mô công ty hiện tại
  (vài trăm công việc/ngày); nếu sau này dữ liệu rất lớn khiến cron kiểm tra quá hạn chạy
  lâu hơn 10 giây, cân nhắc nâng cấp gói Netlify (timeout 26 giây) hoặc tối ưu lại query.

