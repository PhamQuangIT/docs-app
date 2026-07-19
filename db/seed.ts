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

async function insertDept(name: string, parentId: string | null = null) {
  const id = uuid();
  await run(
    "INSERT INTO departments (id, name, parent_id) VALUES (:id, :name, :parent_id)",
    { id, name, parent_id: parentId }
  );
  return id;
}

async function insertPosition(name: string, sortOrder: number) {
  const id = uuid();
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
  reportToId?: string | null;
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

  // Danh sách vị trí mặc định theo yêu cầu công ty
  const positionNames = [
    "Trưởng phòng",
    "Phó phòng SX",
    "Phó phòng gián tiếp",
    "Trưởng nhóm nhận hàng",
    "Trưởng nhóm nhặt lệnh",
    "Trưởng nhóm giao hàng",
    "Trưởng nhóm đóng gói HT trong PS",
    "Trưởng nhóm đóng gói HT ngoài PS",
    "Trưởng nhóm đóng gói Unit",
    "Trưởng nhóm kế hoạch phòng",
    "Trưởng nhóm giám sát",
    "Trưởng nhóm hành chính",
    "Nhân viên kế hoạch sản xuất",
    "Nhân viên giám sát",
    "Nhân viên hành chính",
    "Nhân viên hỗ trợ",
  ];
  const positionIds: Record<string, string> = {};
  for (let i = 0; i < positionNames.length; i++) {
    positionIds[positionNames[i]] = await insertPosition(positionNames[i], i + 1);
  }

  const deptWH = await insertDept("Kho vận hành onsite");
  const deptReceiving = await insertDept("Nhận hàng (Receiving)", deptWH);
  const deptStorage = await insertDept("Lưu kho (Storage)", deptWH);
  const deptPicking = await insertDept("Lấy hàng theo BOM (Picking)", deptWH);
  const deptPacking = await insertDept("Đóng gói thành phẩm (Packing)", deptWH);

  const customer = await insertCustomer(
    "Nhà máy khách hàng - Sản xuất Robot bán dẫn",
    "contact@customer-factory.example"
  );

  const uAdmin = await insertUser("Quản trị hệ thống", "admin@3pl.local", "Admin@123", roleAdmin, null);
  const uOM = await insertUser("Phạm Quang", "quang.pham@3pl.local", "Quang@123", roleOM, deptWH, positionIds["Trưởng phòng"]);
  const uLeaderReceiving = await insertUser("Leader Nhận hàng", "leader.receiving@3pl.local", "Leader@123", roleLeader, deptReceiving, positionIds["Trưởng nhóm nhận hàng"]);
  const uLeaderPacking = await insertUser("Leader Đóng gói", "leader.packing@3pl.local", "Leader@123", roleLeader, deptPacking, positionIds["Trưởng nhóm đóng gói Unit"]);
  const uSupervisorPicking = await insertUser("Supervisor Picking", "sup.picking@3pl.local", "Sup@123", roleSupervisor, deptPicking, positionIds["Trưởng nhóm nhặt lệnh"]);
  const uEmp1 = await insertUser("Nguyễn Văn A", "nva@3pl.local", "Emp@123", roleEmployee, deptReceiving, positionIds["Nhân viên hỗ trợ"]);
  const uEmp2 = await insertUser("Trần Thị B", "ttb@3pl.local", "Emp@123", roleEmployee, deptPacking, positionIds["Nhân viên hỗ trợ"]);
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
    reportToId: uOM,
    departmentId: deptReceiving,
    positionId: positionIds["Trưởng nhóm nhận hàng"],
    deadline: inHours(2),
  });

  await insertWorkItem({
    type: "customer_request",
    title: "Khách hàng yêu cầu bổ sung 5 nhân lực cho lô sản xuất gấp",
    description: "Line trưởng khách hàng báo cần thêm nhân lực picking cho lệnh sản xuất khẩn.",
    priority: "urgent",
    status: "new",
    creatorId: uOM,
    reportToId: uOM,
    departmentId: deptPicking,
    positionId: positionIds["Trưởng nhóm nhặt lệnh"],
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
    reportToId: uOM,
    departmentId: deptPacking,
    positionId: positionIds["Trưởng nhóm đóng gói Unit"],
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
    reportToId: uOM,
    departmentId: deptPicking,
    positionId: positionIds["Trưởng nhóm nhặt lệnh"],
    deadline: inHours(72),
  });

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
