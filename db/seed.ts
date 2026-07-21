import "dotenv/config";
import { run } from "../src/lib/db";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

async function insertRole(name: string, permissions: object) {
  const id = uuid();
  await run(
    "INSERT INTO roles (id, name, permissions) VALUES (:id, :name, :permissions)",
    { id, name, permissions: JSON.stringify(permissions) }
  );
  return id;
}

async function insertDept(id: string, name: string, parentId: string | null = null) {
  await run(
    "INSERT INTO departments (id, name, parent_id) VALUES (:id, :name, :parent_id)",
    { id, name, parent_id: parentId }
  );
  return id;
}

async function insertPosition(id: string, name: string, sortOrder: number) {
  await run(
    "INSERT INTO positions (id, name, sort_order) VALUES (:id, :name, :sort_order)",
    { id, name, sort_order: sortOrder }
  );
  return id;
}

async function insertUser(
  fullName: string,
  email: string,
  password: string,
  roleId: string,
  departmentId: string | null,
  positionId: string | null = null
) {
  const id = uuid();
  const hash = bcrypt.hashSync(password, 10);
  await run(
    `INSERT INTO users (id, full_name, email, password_hash, role_id, department_id, position_id)
     VALUES (:id, :full_name, :email, :password_hash, :role_id, :department_id, :position_id)`,
    {
      id,
      full_name: fullName,
      email,
      password_hash: hash,
      role_id: roleId,
      department_id: departmentId,
      position_id: positionId,
    }
  );
  return id;
}

async function main() {
  console.log("Seeding database...");

  const tables = [
    "announcement_reads",
    "announcements",
    "notifications",
    "escalations",
    "work_item_history",
    "work_item_attachments",
    "work_item_comments",
    "work_items",
    "sla_config",
    "users",
    "customers",
    "departments",
    "positions",
    "roles",
  ];
  for (const t of tables) await run(`DELETE FROM ${t}`);

  // ---- Vai trò (mới - theo Thay_đổi.docx mục 4 + 8) ----
  const roleBGD = await insertRole("BGĐ", { all: true });
  await insertRole("Quản lý", { assign: true, close: true, report_team: true });
  await insertRole("Sản xuất trực tiếp", { update_own: true });
  await insertRole("Gián tiếp", { update_own: true });
  await insertRole("Khách hàng", { view_only: true, create_customer_request: true });

  // ---- Bộ phận / nhóm (phân cấp) ----
  await insertDept("dept-gian-tiep", "Bộ phận gián tiếp", null);
  await insertDept("dept-san-xuat", "Bộ phận sản xuất", null);
  await insertDept("dept-bgd", "Ban giám đốc", null);
  await insertDept("dept-cs", "Phòng dịch vụ khách hàng", null);
  await insertDept("dept-hanh-chinh", "Hành chính", "dept-gian-tiep");
  await insertDept("dept-ke-hoach", "Kế hoạch", "dept-gian-tiep");
  await insertDept("dept-giam-sat", "Giám sát", "dept-gian-tiep");
  await insertDept("dept-dong-goi-trong-ps", "Đóng gói hệ thống trong phòng sạch", "dept-san-xuat");
  await insertDept("dept-dong-goi-ngoai-ps", "Đóng gói hệ thống ngoài phòng sạch", "dept-san-xuat");
  await insertDept("dept-dong-goi-unit", "Đóng gói Unit", "dept-san-xuat");
  await insertDept("dept-nhan-hang", "Nhận hàng", "dept-san-xuat");
  await insertDept("dept-nhat-hang", "Nhặt hàng", "dept-san-xuat");
  await insertDept("dept-giao-hang", "Giao hàng", "dept-san-xuat");

  // ---- Vị trí / chức danh ----
  await insertPosition("pos-khach-hang", "Khách hàng", 0); // đứng đầu trong lựa chọn "Báo cáo cho"
  await insertPosition("pos-giam-doc", "Giám đốc/TL giám đốc", 1);
  await insertPosition("pos-truong-phong", "Trưởng phòng", 2);
  await insertPosition("pos-pho-phong-gian-tiep", "Phó phòng gián tiếp", 3);
  await insertPosition("pos-pho-phong-san-xuat", "Phó phòng sản xuất", 4);
  await insertPosition("pos-tn-nhan-hang", "Trưởng nhóm nhận hàng", 5);
  await insertPosition("pos-tn-nhat-hang", "Trưởng nhóm nhặt hàng", 6);
  await insertPosition("pos-tn-giao-hang", "Trưởng nhóm giao hàng", 7);
  await insertPosition("pos-tn-dg-trong-ps", "Trưởng nhóm đóng gói hệ thống trong phòng sạch", 8);
  await insertPosition("pos-tn-dg-ngoai-ps", "Trưởng nhóm đóng gói hệ thống ngoài phòng sạch", 9);
  await insertPosition("pos-tn-dg-unit", "Trưởng nhóm đóng gói Unit", 10);
  await insertPosition("pos-tn-ke-hoach", "Trưởng nhóm kế hoạch phòng", 11);
  await insertPosition("pos-tn-hanh-chinh", "Trưởng nhóm hành chính", 12);
  await insertPosition("pos-tn-giam-sat", "Trưởng nhóm giám sát", 13);
  await insertPosition("pos-khac", "Khác", 14);

  // ---- Tài khoản duy nhất: BGĐ dự phòng ----
  // (Không tạo sẵn tài khoản demo nào khác - công ty tự tạo tài khoản thật qua trang Quản lý người dùng)
  await insertUser("Quản trị hệ thống", "admin@3pl.local", "Admin@123", roleBGD, null);

  console.log("Seed thành công.");
  console.log("Tài khoản BGĐ dự phòng duy nhất:");
  console.log(" - admin@3pl.local / Admin@123 (BGĐ)");
  console.log("=> Đăng nhập ngay và tạo tài khoản thật (email công ty) qua trang Quản lý người dùng.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
