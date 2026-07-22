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

## Ghi chú vận hành - đăng nhập chập chờn (21/07/2026)

Gặp hiện tượng thỉnh thoảng đăng nhập báo "Sai email hoặc mật khẩu" dù tài khoản/mật khẩu đúng, tự hết sau vài lần thử.
Nhiều khả năng do kết nối tới DB (Postgres serverless) bị chập chờn, không phải do dữ liệu/mật khẩu.
Đã hạ `max` pool kết nối (10 → 3) + thêm timeout kết nối rõ ràng + tách lỗi kết nối DB ra khỏi lỗi sai mật khẩu
(giờ sẽ hiện "Không kết nối được hệ thống, vui lòng thử lại" thay vì gây hiểu lầm). Nếu còn lặp lại, kiểm tra thêm:
chuỗi kết nối `DATABASE_URL` có đang trỏ đúng "pooled connection" của Neon/Supabase (không phải kết nối trực tiếp) không.

## Cập nhật mới nhất (đợt 6 - Master Prompt Redesign Dashboard 22/07/2026)

- **Redesign Dashboard**: layout 2 cột (65%-35%), 4 thẻ KPI, gộp Quá hạn/Deadline hôm nay/Việc của tôi/Việc đã giao
  thành 1 card dạng Tab (thêm mới "Việc đã giao" = các việc mà chính mình là Người giao việc), widget Yêu cầu KH
  đang mở + Hiệu suất phòng ban (màu đỏ/xanh theo % đúng hạn). Design tokens mới: primary `#2563eb`, nền `#f4f6f9`.
- **NavBar mới**: gọn lại còn Dashboard/Công việc/Báo cáo/Bảng tin, thêm ô tìm kiếm, nút "+ Tạo việc", chuông thông
  báo, và Avatar có dropdown (Việc của tôi, Đổi mật khẩu, Quản trị hệ thống, Đăng xuất) thay vì bày hết ra ngoài.
- **Sửa lỗi cuộn Modal "Tạo phát sinh mới"**: tái cấu trúc theo header/body/footer (`flex-col`, body `flex-1
  overflow-y-auto min-h-0`, header/footer `shrink-0`), overlay dùng `items-start` + `my-auto` thay vì `items-center`
  đơn thuần - khắc phục lỗi kéo lên không tới đỉnh, che mất Header khi form dài hơn màn hình.
- **Thời hạn định kỳ (Recurring Tasks)**: thêm trường "Loại thời hạn" (Một lần/Ngày/Tuần/Tháng/Năm) khi tạo việc.
  Cron (`scripts/check-overdue.ts` + `netlify/functions/check-overdue.ts`, chạy mỗi 5 phút) tự sinh việc kế tiếp
  khi tới hạn, dời mốc sinh việc của "việc gốc" sang chu kỳ sau. Xem `runRecurringGeneration()` trong `cron-logic.ts`.
- **Email theo dõi + gợi ý autocomplete**: thêm trường "Email theo dõi" (báo cho người ngoài hệ thống) trong mục
  "+ Thêm..." của form tạo việc, có gợi ý các email đã dùng trước đó (bảng `known_watcher_emails`, API
  `/api/watcher-emails`).
- **RBAC - Super Admin theo email duy nhất**: `canManageUsers()` đổi từ kiểm tra role "BGĐ" sang kiểm tra ĐÚNG
  1 email Super Admin (`admin@3pl.local`, có thể đổi qua biến môi trường `SUPER_ADMIN_EMAIL`). **BGĐ từ nay KHÔNG
  còn quyền Quản trị hệ thống** (thêm/sửa/xóa user, reset mật khẩu) - quyền của BGĐ trên các phần khác (giao việc,
  duyệt đề xuất, xem báo cáo) không đổi, tương đương Quản lý.
- Chạy `db/migration_009_recurring_watcher.sql` trên DB thật (thêm cột recurrence*/watcher_email + bảng
  known_watcher_emails, không mất dữ liệu).

**Giả định cần anh xác nhận:**
- "Email theo dõi" hiện là 1 trường TỰ DO (không bắt buộc là tài khoản có sẵn), chỉ dùng để lưu vết + gợi ý, KHÔNG
  tự động gửi email thật (hệ thống hiện chưa có dịch vụ gửi email) - nếu cần gửi email thật, cần tích hợp thêm
  dịch vụ SMTP/email provider.
- Việc định kỳ: deadline lần sinh sau = deadline lần trước + đúng 1 chu kỳ (giữ nguyên giờ trong ngày, vd luôn
  18:00 mỗi ngày/tuần/tháng/năm). Việc được sinh ra ở trạng thái giống việc gốc lúc tạo (draft nếu chưa có owner,
  pending_acceptance nếu có).

## Cập nhật mới nhất (đợt 5 - theo file Thay_đổi.docx 21/07/2026)

**Đã xác nhận với người yêu cầu 3 điểm lớn trước khi làm:**
1. "Người chịu trách nhiệm chính" khi tạo việc: **đổi từ nhập tay tự do sang bắt buộc chọn 1 tài khoản có sẵn**, bỏ nút "Gán việc" tách rời.
2. Đổi **toàn bộ 7 trạng thái cũ sang đúng 9 trạng thái mới** theo tài liệu (không giữ song song 2 hệ trạng thái).
3. "Báo cáo cho" **giữ nguyên theo Chức danh** như đợt 4 (không đổi sang chọn theo người cụ thể).

**Đã làm:**
- **Reset Password cho user** (mục 12): trang Quản lý người dùng → Sửa → 2 ô Mật khẩu mới/Xác nhận, ghi `admin_audit_log`.
- **9 trạng thái công việc mới**: Nháp → Chờ tiếp nhận → Đang thực hiện → (Chờ duyệt thay đổi / Chờ duyệt hoàn thành / Yêu cầu xử lý lại) → Hoàn thành/Đã hủy; thêm "Từ chối tiếp nhận". Dữ liệu cũ tự động map: new→Nháp, assigned→Chờ tiếp nhận, doing/waiting→Đang thực hiện, completed/closed→Hoàn thành (chạy `db/migration_008_task_role_workflow.sql`).
- **Tạo việc**: bắt buộc chọn Người chịu trách nhiệm chính khi bấm "Tạo và giao việc"; có nút "Lưu nháp" riêng nếu chưa xác định được người. Thêm chọn nhiều **Người phối hợp**.
- **Vai trò theo từng việc** (`src/lib/workflow.ts`): Người tạo / Người giao việc / Người chịu trách nhiệm chính / Người phối hợp - tách biệt với vai trò toàn cục (BGĐ/Quản lý/...).
- **Tiếp nhận / Từ chối tiếp nhận** (API mới `/accept`, `/reject-acceptance`): chỉ Người chịu trách nhiệm chính.
- **Đề xuất** (`/propose`): 4 loại complete/cancel/edit/reassign. complete/cancel/edit chỉ Người chịu trách nhiệm chính được đề xuất (Người giao việc có thao tác trực tiếp riêng, không cần đề xuất); reassign chỉ Người giao việc đề xuất. Chỉ 1 đề xuất mở tại 1 thời điểm/việc.
- **Thao tác trực tiếp của Người giao việc** (không qua duyệt, vì họ đã là người quyết định - mục 8): Điều chỉnh phân công (API `/assign`, đổi tên từ "Gán việc"), Sửa việc (PATCH `/work-items/:id`, bắt buộc lý do nếu đã có người chịu trách nhiệm), Yêu cầu xử lý lại, Hủy việc, Mở lại trong 48h.

**Giả định/đơn giản hóa cần anh xem lại nếu chưa đúng ý:**
- Trạng thái "Chờ" (waiting) cũ không có tương đương trực tiếp trong 9 trạng thái mới → đã gộp vào "Đang thực hiện" (lý do treo việc vẫn ghi được qua bình luận/lịch sử, không còn là 1 trạng thái riêng).
- Đề xuất loại "reassign" (giao lại người) đã có API nhưng **chưa lộ nút riêng ngoài giao diện** - hiện tại Người giao việc dùng luôn nút "Điều chỉnh phân công" (có hiệu lực ngay, không cần ai duyệt thêm) vì họ vốn đã là cấp quyết định cuối theo mô hình hiện tại. Nếu anh cần thêm 1 lớp duyệt bởi "cấp cao hơn" cho việc đổi người, báo lại để bổ sung.
- Trạng thái "Chờ duyệt thay đổi"/"Chờ duyệt hoàn thành" chỉ vào được qua nút đề xuất (không có nút đổi trạng thái tay trực tiếp), đúng theo mục 6 tài liệu.

## Cập nhật mới nhất (đợt 4 - theo file Thay_đổi.docx)

- **Đổi hệ Vai trò**: BGĐ / Quản lý / Sản xuất trực tiếp / Gián tiếp / Khách hàng (thay cho Admin/Operation Manager/Leader/Supervisor/Employee/Viewer cũ) — xem bảng phân quyền chi tiết trong `src/lib/auth.ts`
- Thêm 2 bộ phận cấp cao nhất: **Ban giám đốc**, **Phòng dịch vụ khách hàng**
- **Cơ chế Đề xuất**: người được giao việc (owner) đề nghị Hoàn thành/Hủy/Sửa nội dung-hạn, gửi cho người giao việc (assigned_by_id) duyệt trước khi có hiệu lực thật — không tự ý đổi trạng thái nữa
- **"Việc của tôi"** giờ hiển thị cả việc gán theo đúng Vị trí chịu trách nhiệm của bạn, không chỉ việc gán trực tiếp
- **Đăng nhập lại khi đóng trình duyệt** — không còn tự động giữ đăng nhập 7 ngày
- Toàn bộ ô mật khẩu có nút hiện/ẩn (icon con mắt)
- Trang Người dùng có nút **"Sửa"** để đổi vai trò/bộ phận/vị trí ngay trong app (không cần vào Supabase)
- Nếu đang cập nhật từ bản deploy cũ hơn, chạy `db/migration_005_new_roles.sql` rồi `db/migration_006_proposals.sql` (xem `DEPLOY.md`)

## Cập nhật mới nhất (đợt 2 - theo file Thay_đổi.docx)

- **Xoá 7 tài khoản demo** (bao gồm cả "Phạm Quang" mẫu ban đầu) — hệ thống giờ chỉ còn 1 tài
  khoản Admin dự phòng (`admin@3pl.local`), công ty tự tạo tài khoản thật qua trang Quản lý người dùng
- **"Người chịu trách nhiệm" lúc tạo việc** đổi thành ô nhập tay tự do (ghi chú, không gắn tài khoản)
  — muốn kích hoạt "Việc của tôi"/"Gán cho tôi"/thông báo tự động, cần dùng nút "Gán việc" ở trang chi tiết
- **"Báo cáo cho"** giờ có thêm lựa chọn **"Khác"** (nhập tay chức danh tùy ý), và **"Khách hàng"** đứng đầu danh sách
- Nếu đang cập nhật từ bản deploy cũ hơn, xem mục **"Đã deploy từ trước — cập nhật đợt mới nhất"** trong `DEPLOY.md` — chạy `db/migration_004_cleanup_demo.sql`

## Cập nhật mới nhất (theo yêu cầu điều chỉnh)

- **Bộ phận/nhóm** giờ có phân cấp: Bộ phận gián tiếp (Hành chính, Kế hoạch, Giám sát) và
  Bộ phận sản xuất (Nhận hàng, Nhặt hàng, Giao hàng, Đóng gói HT trong/ngoài phòng sạch, Đóng gói Unit)
- **Vị trí (chức danh)** đổi thành 13 chức danh quản lý + "Khác" (cho nhập tên tùy ý, tự thêm vào danh mục dùng lần sau)
- **Báo cáo cho** đổi từ chọn theo tên người sang chọn theo **chức danh** (13 chức danh + "Khách hàng"); khi chọn 1 chức danh, hệ thống tự thông báo cho (các) nhân viên đang giữ chức danh đó
- **Bảng tin nội bộ** (mới): ai cũng đăng được, hiển thị cho mọi người khi mở phần mềm, bắt buộc bấm "Đã đọc" từng tin mới thao tác tiếp được
- Nếu đang cập nhật từ bản deploy cũ hơn, xem mục **"Đã deploy từ trước và muốn cập nhật bản mới nhất"** trong `DEPLOY.md` — chạy `db/migration_003_reorg.sql`

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
