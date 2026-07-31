// Biểu đồ cột chồng đơn giản, tự vẽ bằng SVG (không cần thêm thư viện) —
// mô phỏng theo giao diện tham khảo: mỗi cột là 1 dự án/nhóm, chia màu theo
// trạng thái, có chú giải màu bên cạnh.
const SEGMENTS = [
  { key: "done", label: "Hoàn thành", color: "var(--stat-green)" },
  { key: "doing", label: "Đang thực hiện", color: "var(--stat-blue)" },
  { key: "blocked", label: "Chờ duyệt / Vướng mắc", color: "var(--stat-purple)" },
  { key: "todo", label: "Chưa bắt đầu", color: "#CBD5E1" },
  { key: "overdue", label: "Quá hạn", color: "var(--stat-red)" },
];

export default function StackedBarChart({ data }) {
  const max = Math.max(1, ...data.map(d => d.total || 0));
  const chartH = 160;

  return (
    <div className="stacked-chart">
      <div className="stacked-chart-bars">
        {data.map(d => {
          let acc = 0;
          return (
            <div key={d.label} className="stacked-chart-col">
              <div className="stacked-chart-bar-wrap" style={{ height: chartH }}>
                {SEGMENTS.map(seg => {
                  const v = d[seg.key] || 0;
                  if (!v) return null;
                  const h = (v / max) * chartH;
                  const bottom = (acc / max) * chartH;
                  acc += v;
                  return (
                    <div
                      key={seg.key}
                      className="stacked-chart-seg"
                      title={`${seg.label}: ${v}`}
                      style={{ height: h, bottom, background: seg.color }}
                    />
                  );
                })}
              </div>
              <span className="stacked-chart-label">{d.label}</span>
            </div>
          );
        })}
      </div>
      <div className="stacked-chart-legend">
        {SEGMENTS.map(seg => (
          <div key={seg.key} className="stacked-chart-legend-item">
            <span className="stacked-chart-dot" style={{ background: seg.color }} />
            {seg.label}
          </div>
        ))}
      </div>
    </div>
  );
}
