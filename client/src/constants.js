import { Circle, Clock3, CheckCircle2, PauseCircle } from "lucide-react";

export const PHASES = [
  { key: "CT", label: "Chủ trương đầu tư & Lựa chọn nhà đầu tư", sub: "Khảo sát địa điểm → CTCTĐT → Đấu thầu lựa chọn nhà đầu tư" },
  { key: "QHDAT", label: "Quy hoạch & Đất đai", sub: "Quy hoạch chi tiết 1/500 → Thu hồi đất → Bồi thường, GPMB" },
  { key: "XD", label: "Chuẩn bị đầu tư xây dựng", sub: "BCNCKT/TKCS → Thiết kế xây dựng → Giấy phép xây dựng" },
  { key: "THICONG", label: "Thi công & Nghiệm thu, bàn giao", sub: "Triển khai thi công → Nghiệm thu → Bàn giao đưa vào sử dụng" },
];

export const STATUS = {
  todo: { label: "Chưa bắt đầu", color: "#64748B", bg: "#F1F5F9", icon: Circle },
  doing: { label: "Đang thực hiện", color: "#3B82F6", bg: "#DBEAFE", icon: Clock3 },
  done: { label: "Hoàn thành", color: "#22C55E", bg: "#DCFCE7", icon: CheckCircle2 },
  blocked: { label: "Tạm dừng / Vướng mắc", color: "#8B5CF6", bg: "#EDE9FE", icon: PauseCircle },
};

export const ROLE_OPTIONS = [
  { key: "viewer", label: "Chỉ xem" },
  { key: "name_editor", label: "Chỉ sửa tên đầu việc" },
  { key: "process_editor", label: "Chỉ thêm quy trình" },
  { key: "editor", label: "Chỉnh sửa toàn quyền" },
];

export function roleLabel(key) {
  return ROLE_OPTIONS.find(r => r.key === key)?.label || (key === "owner" ? "Chủ dự án" : key);
}

const ROMAN_TABLE = [
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];
export function toRoman(num) {
  let n = num, out = "";
  for (const [val, sym] of ROMAN_TABLE) {
    while (n >= val) { out += sym; n -= val; }
  }
  return out || "I";
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function isOverdue(due, status) {
  if (!due || status === "done") return false;
  return due < todayISO();
}
