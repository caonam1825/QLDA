// Định kỳ quét toàn bộ công việc, gửi nhắc việc qua Zalo cho nhân viên đã
// liên kết Zalo (xem routes/zalo.js) khi công việc trễ hạn hoặc sắp đến hạn
// trong 1 ngày tới. Mỗi công việc chỉ nhắc tối đa 1 lần/ngày cho mỗi loại,
// cho MỖI người phụ trách riêng (1 việc có thể giao nhiều người, mỗi người
// đều nhận được nhắc riêng) — theo dõi qua bảng reminder_log.

const db = require("./db");
const { nanoid } = require("nanoid");
const { sendZaloText, isZaloConfigured } = require("./zalo");

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function parseAssigneeIds(raw) {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

function alreadySent(taskId, staffId, kind, date) {
  return !!db
    .prepare("SELECT 1 FROM reminder_log WHERE task_id = ? AND staff_id = ? AND kind = ? AND sent_date = ?")
    .get(taskId, staffId, kind, date);
}

function markSent(taskId, staffId, kind, date) {
  db.prepare(
    "INSERT OR IGNORE INTO reminder_log (id, task_id, staff_id, kind, sent_date, created_at) VALUES (?,?,?,?,?,?)"
  ).run(nanoid(), taskId, staffId, kind, date, Date.now());
}

async function runReminderSweep() {
  if (!isZaloConfigured()) return; // im lặng bỏ qua nếu chưa cấu hình OA

  const today = todayStr();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const tasks = db
    .prepare(
      `SELECT t.*, p.name AS project_name FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.status != 'done' AND t.due_date != '' AND t.assignee_staff_ids != '[]'`
    )
    .all();

  for (const t of tasks) {
    let kind = null;
    if (t.due_date < today) kind = "overdue";
    else if (t.due_date === today || t.due_date === tomorrow) kind = "due_soon";
    if (!kind) continue;

    const assigneeIds = parseAssigneeIds(t.assignee_staff_ids);
    for (const staffId of assigneeIds) {
      const staff = db.prepare("SELECT * FROM staff WHERE id = ?").get(staffId);
      if (!staff || !staff.zalo_id) continue;
      if (alreadySent(t.id, staff.id, kind, today)) continue;

      const text =
        kind === "overdue"
          ? `⚠️ Công việc TRỄ HẠN — "${t.title}" (dự án: ${t.project_name}) — hạn hoàn thành: ${t.due_date}. Vui lòng cập nhật tiến độ trên phần mềm.`
          : `⏰ Công việc SẮP ĐẾN HẠN — "${t.title}" (dự án: ${t.project_name}) — hạn hoàn thành: ${t.due_date}.`;

      await sendZaloText(staff.zalo_id, text);
      markSent(t.id, staff.id, kind, today);
    }
  }
}

// Chạy mỗi 30 phút. Gọi 1 lần lúc khởi động (sau 10s để server ổn định).
function startReminderScheduler() {
  setTimeout(() => { runReminderSweep().catch(e => console.error("[reminders] Lỗi:", e.message)); }, 10_000);
  setInterval(() => { runReminderSweep().catch(e => console.error("[reminders] Lỗi:", e.message)); }, 30 * 60 * 1000);
}

module.exports = { startReminderScheduler, runReminderSweep };
