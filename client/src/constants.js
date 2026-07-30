import { Circle, Clock3, CheckCircle2, PauseCircle } from "lucide-react";

export const PHASES = [
  { key: "QH", label: "Quy hoạch xây dựng", sub: "1/2000 · 1/500" },
  { key: "A", label: "Giai đoạn A", sub: "Chủ trương đầu tư → Ký hợp đồng nhà đầu tư" },
  { key: "B", label: "Giai đoạn B", sub: "Ký hợp đồng → Khởi công" },
];

export const STATUS = {
  todo: { label: "Chưa bắt đầu", color: "#5B6472", bg: "#EEECE3", icon: Circle },
  doing: { label: "Đang thực hiện", color: "#A9832E", bg: "#F6EFDD", icon: Clock3 },
  done: { label: "Hoàn thành", color: "#2F6D5D", bg: "#E4EFEA", icon: CheckCircle2 },
  blocked: { label: "Tạm dừng / Vướng mắc", color: "#9E2B25", bg: "#F5E4E2", icon: PauseCircle },
};

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
