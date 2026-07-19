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

async function insertCustomer(name: string, contact: string) {
  const id = uuid();
  await run(
    "INSERT INTO customers (id, name, contact_info) VALUES (:id, :name, :contact_info)",
    { id, name, contact_info: contact }
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

async function insertWorkItem(opts: {
  type: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  creatorId: string;
  ownerId?: string | null;
  assignedById?: string | null;
  reportToId?: string | null; // giờ là position_id (chức danh), không còn là user
  departmentId?: string | null;
  positionId?: string | null;
  customerId?: string | null;
  deadline: string;
}) {
  const id = uuid();
  await run(
    `INSERT INTO work_items
     (id, type, title, description, priority, status, creator_id, owner_id, assigned_by_id, report_to_id, department_id, position_id, customer_id, deadline, assigned_at)
     VALUES (:id, :type, :title, :description, :priority, :status, :creator_id, :owner_id, :assigned_by_id, :report_to_id, :department_id, :position_id, :customer_id, :deadline, :assigned_at)`,
    {
      id,
      type: opts.type,
      title: opts.title,
      description: opts.description ?? null,
      priority: opts.priority,
      status: opts.status,
      creator_id: opts.creatorId,
      owner_id: opts.ownerId ?? null,
      assigned_by_id: opts.assignedById ?? null,
      report_to_id: opts.reportToId ?? null,
      department_id: opts.departmentId ?? null,
      position_id: opts.positionId ?? null,
      customer_id: opts.customerId ?? null,
      deadline: opts.deadline,
      assigned_at: opts.ownerId ? new Date().toISOString() : null,
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

  const roleAdmin = await insertRole("Admin", { all: true });
  const roleOM = await insertRole("Operation Manager", { manage_all: true, report: true });
  const roleLeader = await insertRole("Leader", { assign: true, close: true, report_team: true });
  const roleSupervisor = await insertRole("Supervisor", { create: true, assign_team: true });
  const roleEmployee = await insertRole("Employee", { update_own: true });
  const roleViewer = await insertRole("Viewer", { view_only: true, create_customer_request: true });

  // ---- Bộ phận / nhóm (phân cấp) ----
  await insertDept("dept-gian-tiep", "Bộ phận gián tiếp", null);
  await insertDept("dept-san-xuat", "Bộ phận sản xuất", null);
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
  await insertPosition("pos-khach-hang", "Khách hàng", 99); // chỉ dùng cho "Báo cáo cho"

  const customer = await insertCustomer(
    "Nhà máy khách hàng - Sản xuất Robot bán dẫn",
    "contact@customer-factory.example"
  );

  const uAdmin = await insertUser("Quản trị hệ thống", "admin@3pl.local", "Admin@123", roleAdmin, null);
  const uOM = await insertUser("Phạm Quang", "quang.pham@3pl.local", "Quang@123", roleOM, "dept-gian-tiep", "pos-truong-phong");
  const uLeaderReceiving = await insertUser("Leader Nhận hàng", "leader.receiving@3pl.local", "Leader@123", roleLeader, "dept-nhan-hang", "pos-tn-nhan-hang");
  const uLeaderPacking = await insertUser("Leader Đóng gói", "leader.packing@3pl.local", "Leader@123", roleLeader, "dept-dong-goi-unit", "pos-tn-dg-unit");
  const uSupervisorPicking = await insertUser("Supervisor Picking", "sup.picking@3pl.local", "Sup@123", roleSupervisor, "dept-nhat-hang", "pos-tn-nhat-hang");
  const uEmp1 = await insertUser("Nguyễn Văn A", "nva@3pl.local", "Emp@123", roleEmployee, "dept-nhan-hang", "pos-khac");
  const uEmp2 = await insertUser("Trần Thị B", "ttb@3pl.local", "Emp@123", roleEmployee, "dept-dong-goi-unit", "pos-khac");
  const uViewer = await insertUser("Đại diện khách hàng", "viewer@customer.local", "Viewer@123", roleViewer, null);

  const slaDefaults: [string, number, number][] = [
    ["urgent", 15, 240],
    ["high", 60, 1440],
    ["normal", 240, 4320],
    ["low", 1440, 10080],
  ];
  for (const [priority, response, resolution] of slaDefaults) {
    await run(
      `INSERT INTO sla_config (id, priority, response_minutes, resolution_minutes, customer_id)
       VALUES (:id, :priority, :response_minutes, :resolution_minutes, NULL)`,
      { id: uuid(), priority, response_minutes: response, resolution_minutes: resolution }
    );
  }

  const now = new Date();
  const inHours = (h: number) => new Date(now.getTime() + h * 3600 * 1000).toISOString();

  await insertWorkItem({
    type: "issue",
    title: "Thiếu 2 nhân viên ca sáng tại tổ Nhận hàng",
    description: "Cần điều chuyển tạm từ tổ Đóng gói để kịp nhận container 8h30.",
    priority: "urgent",
    status: "doing",
    creatorId: uLeaderReceiving,
    ownerId: uLeaderReceiving,
    assignedById: uLeaderReceiving,
    reportToId: "pos-truong-phong",
    departmentId: "dept-nhan-hang",
    positionId: "pos-tn-nhan-hang",
    deadline: inHours(2),
  });

  await insertWorkItem({
    type: "customer_request",
    title: "Khách hàng yêu cầu bổ sung 5 nhân lực cho lô sản xuất gấp",
    description: "Line trưởng khách hàng báo cần thêm nhân lực picking cho lệnh sản xuất khẩn.",
    priority: "urgent",
    status: "new",
    creatorId: uOM,
    reportToId: "pos-khach-hang",
    departmentId: "dept-nhat-hang",
    positionId: "pos-tn-nhat-hang",
    customerId: customer,
    deadline: inHours(-1),
  });

  await insertWorkItem({
    type: "task",
    title: "Đào tạo quy trình 5S cho nhân viên mới tổ Đóng gói",
    priority: "normal",
    status: "assigned",
    creatorId: uOM,
    ownerId: uLeaderPacking,
    assignedById: uOM,
    reportToId: "pos-truong-phong",
    departmentId: "dept-dong-goi-unit",
    positionId: "pos-tn-dg-unit",
    deadline: inHours(48),
  });

  await insertWorkItem({
    type: "meeting_action",
    title: "Cập nhật lại vị trí kệ hàng theo họp cải tiến kho tuần trước",
    priority: "low",
    status: "waiting",
    creatorId: uOM,
    ownerId: uSupervisorPicking,
    assignedById: uOM,
    reportToId: "pos-truong-phong",
    departmentId: "dept-nhat-hang",
    positionId: "pos-tn-nhat-hang",
    deadline: inHours(72),
  });

  // Bảng tin nội bộ mẫu
  const annId = uuid();
  await run(
    `INSERT INTO announcements (id, title, content, created_by) VALUES (:id, :title, :content, :created_by)`,
    {
      id: annId,
      title: "Chào mừng sử dụng hệ thống quản lý vận hành",
      content: "Mọi phát sinh trong ca làm việc cần được ghi nhận trên hệ thống này thay vì Zalo/điện thoại. Vui lòng đọc kỹ hướng dẫn trước khi thao tác.",
      created_by: uOM,
    }
  );

  console.log("Seed thành công.");
  console.log("Tài khoản đăng nhập mẫu:");
  console.log(" - admin@3pl.local / Admin@123 (Admin)");
  console.log(" - quang.pham@3pl.local / Quang@123 (Operation Manager)");
  console.log(" - leader.receiving@3pl.local / Leader@123 (Leader)");
  console.log(" - sup.picking@3pl.local / Sup@123 (Supervisor)");
  console.log(" - nva@3pl.local / Emp@123 (Employee)");
  console.log(" - viewer@customer.local / Viewer@123 (Viewer)");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
