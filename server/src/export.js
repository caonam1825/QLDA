// Xuất báo cáo ra PDF (thư viện pdfkit) và Word/.docx (thư viện docx).
//
// LƯU Ý CÀI ĐẶT: đây là 2 thư viện MỚI chưa có trong package.json gốc — cần
// chạy `npm install pdfkit docx` trong thư mục server trước khi dùng tính
// năng xuất báo cáo (đã thêm sẵn vào server/package.json, chỉ cần npm install).

const PDFDocument = require("pdfkit");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle,
} = require("docx");

const RANGE_LABEL = { day: "Báo cáo ngày", week: "Báo cáo tuần" };

function todayVN() {
  return new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ============================== PDF ============================== */

function pdfCollect(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      buildFn(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function pdfSectionTitle(doc, text) {
  doc.moveDown(0.6).fontSize(13).fillColor("#1E2A44").text(text, { underline: false });
  doc.moveDown(0.2).fontSize(10).fillColor("#000000");
}

function pdfTaskList(doc, items, emptyText) {
  if (!items || items.length === 0) {
    doc.fillColor("#666666").text(emptyText || "Không có.");
    doc.fillColor("#000000");
    return;
  }
  items.forEach((t) => {
    const due = t.due ? ` — Hạn: ${t.due}${t.dueLocked ? " (đã khoá)" : ""}` : "";
    doc.text(`• ${t.title}  —  Người phụ trách: ${t.assignee || "Chưa gán"}${due}`);
  });
}

async function buildProjectReportPdf(projectName, range, data) {
  return pdfCollect((doc) => {
    doc.fontSize(16).fillColor("#1E2A44").text("BAN DỰ ÁN - TCT CỔ PHẦN HỢP LỰC", { align: "center" });
    doc.fontSize(13).text(`${RANGE_LABEL[range] || "Báo cáo"} — ${projectName}`, { align: "center" });
    doc.fontSize(9).fillColor("#666666").text(`Xuất lúc: ${todayVN()}`, { align: "center" });
    doc.fillColor("#000000");

    pdfSectionTitle(doc, `Trễ hạn — cần nhắc nhở (${data.overdueList.length})`);
    pdfTaskList(doc, data.overdueList, "Không có việc nào trễ hạn.");

    pdfSectionTitle(doc, `Đang thực hiện (${data.inProgressList.length})`);
    pdfTaskList(doc, data.inProgressList, "Không có việc nào đang thực hiện.");

    pdfSectionTitle(doc, `Dự kiến thực hiện (${data.upcomingList.length})`);
    pdfTaskList(doc, data.upcomingList, "Không có việc nào sắp đến hạn.");

    pdfSectionTitle(doc, `Đã hoàn thành (${data.doneCount})`);
    pdfTaskList(doc, data.doneList, "Chưa có việc nào hoàn thành trong khoảng thời gian này.");

    pdfSectionTitle(doc, "Tổng hợp theo nhân viên");
    const colX = [doc.page.margins.left, 220, 300, 380, 460];
    doc.fontSize(9).fillColor("#1E2A44");
    doc.text("Người phụ trách", colX[0], doc.y, { continued: false });
    const headerY = doc.y - doc.currentLineHeight();
    doc.text("Hoàn thành", colX[1], headerY);
    doc.text("Đang làm", colX[2], headerY);
    doc.text("Chưa làm", colX[3], headerY);
    doc.text("Trễ hạn", colX[4], headerY);
    doc.moveDown(0.3);
    doc.fillColor("#000000");
    data.byStaff.forEach((s) => {
      const y = doc.y;
      doc.text(s.name, colX[0], y, { width: 170 });
      doc.text(String(s.done), colX[1], y);
      doc.text(String(s.doing), colX[2], y);
      doc.text(String(s.todo), colX[3], y);
      doc.text(String(s.overdue), colX[4], y);
      doc.moveDown(0.2);
    });
  });
}

async function buildOverviewPdf(overview, kpi) {
  return pdfCollect((doc) => {
    doc.fontSize(16).fillColor("#1E2A44").text("BAN DỰ ÁN - TCT CỔ PHẦN HỢP LỰC", { align: "center" });
    doc.fontSize(13).text("Báo cáo tổng hợp toàn hệ thống & Xếp hạng KPI", { align: "center" });
    doc.fontSize(9).fillColor("#666666").text(`Xuất lúc: ${todayVN()}`, { align: "center" });
    doc.fillColor("#000000");

    pdfSectionTitle(doc, `Tất cả dự án (${overview.projects.length})`);
    overview.projects.forEach((p) => {
      doc.text(`• ${p.name} — Tổng việc: ${p.total} · Hoàn thành: ${p.done} (${p.percent}%) · Trễ hạn: ${p.overdue}`);
    });
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text(
      `Tổng cộng: ${overview.totals.total} việc · Hoàn thành: ${overview.totals.done} · Trễ hạn: ${overview.totals.overdue}`
    );
    doc.font("Helvetica");

    pdfSectionTitle(doc, `Trễ hạn — tất cả dự án (${overview.overdueList.length})`);
    pdfTaskList(
      doc,
      overview.overdueList.map((t) => ({ title: t.title, assignee: t.assignee, due: t.due })),
      "Không có việc nào trễ hạn."
    );

    pdfSectionTitle(doc, "Xếp hạng KPI nhân viên");
    doc.fontSize(8).fillColor("#666666").text(
      "Điểm = (hoàn thành đúng hạn x3) + (hoàn thành trễ hạn x1) - (đang trễ hạn x2) - (đang vướng mắc x1)."
    );
    doc.fillColor("#000000").fontSize(9);
    kpi.ranking.forEach((r) => {
      doc.text(
        `${r.rank}. ${r.name}${r.position ? ` (${r.position})` : ""} — Được giao: ${r.assigned} · ` +
        `Hoàn thành: ${r.completed} (${r.completionRate}%) · Đúng hạn: ${r.completedOnTime} · ` +
        `Đang trễ hạn: ${r.overdueOpen} · Điểm KPI: ${r.score}`
      );
    });
  });
}

/* ============================== DOCX ============================== */

function docxHeading(text, level = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } });
}

function docxTaskParas(items, emptyText) {
  if (!items || items.length === 0) {
    return [new Paragraph({ text: emptyText || "Không có.", italics: true })];
  }
  return items.map((t) => {
    const due = t.due ? `  —  Hạn: ${t.due}${t.dueLocked ? " (đã khoá)" : ""}` : "";
    return new Paragraph({
      bullet: { level: 0 },
      children: [
        new TextRun({ text: `${t.title}  —  Người phụ trách: ${t.assignee || "Chưa gán"}${due}` }),
      ],
    });
  });
}

function docxSimpleTable(headers, rows) {
  const mkCell = (text, bold) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: !!bold })] })],
    width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
  });
  const headerRow = new TableRow({ children: headers.map((h) => mkCell(h, true)) });
  const bodyRows = rows.map((row) => new TableRow({ children: row.map((c) => mkCell(c)) }));
  return new Table({ rows: [headerRow, ...bodyRows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

async function buildProjectReportDocx(projectName, range, data) {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "BAN DỰ ÁN - TCT CỔ PHẦN HỢP LỰC", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
        new Paragraph({
          text: `${RANGE_LABEL[range] || "Báo cáo"} — ${projectName}`,
          heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: `Xuất lúc: ${todayVN()}`, alignment: AlignmentType.CENTER }),

        docxHeading(`Trễ hạn — cần nhắc nhở (${data.overdueList.length})`),
        ...docxTaskParas(data.overdueList, "Không có việc nào trễ hạn."),

        docxHeading(`Đang thực hiện (${data.inProgressList.length})`),
        ...docxTaskParas(data.inProgressList, "Không có việc nào đang thực hiện."),

        docxHeading(`Dự kiến thực hiện (${data.upcomingList.length})`),
        ...docxTaskParas(data.upcomingList, "Không có việc nào sắp đến hạn."),

        docxHeading(`Đã hoàn thành (${data.doneCount})`),
        ...docxTaskParas(data.doneList, "Chưa có việc nào hoàn thành trong khoảng thời gian này."),

        docxHeading("Tổng hợp theo nhân viên"),
        docxSimpleTable(
          ["Người phụ trách", "Hoàn thành", "Đang làm", "Chưa làm", "Trễ hạn"],
          data.byStaff.map((s) => [s.name, s.done, s.doing, s.todo, s.overdue])
        ),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

async function buildOverviewDocx(overview, kpi) {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "BAN DỰ ÁN - TCT CỔ PHẦN HỢP LỰC", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
        new Paragraph({
          text: "Báo cáo tổng hợp toàn hệ thống & Xếp hạng KPI",
          heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: `Xuất lúc: ${todayVN()}`, alignment: AlignmentType.CENTER }),

        docxHeading(`Tất cả dự án (${overview.projects.length})`),
        docxSimpleTable(
          ["Dự án", "Tổng việc", "Hoàn thành", "% hoàn thành", "Trễ hạn"],
          overview.projects.map((p) => [p.name, p.total, p.done, `${p.percent}%`, p.overdue])
        ),

        docxHeading(`Trễ hạn — tất cả dự án (${overview.overdueList.length})`),
        ...docxTaskParas(
          overview.overdueList.map((t) => ({ title: t.title, assignee: t.assignee, due: t.due })),
          "Không có việc nào trễ hạn."
        ),

        docxHeading("Xếp hạng KPI nhân viên"),
        new Paragraph({
          children: [new TextRun({
            italics: true, size: 18,
            text: "Điểm = (hoàn thành đúng hạn x3) + (hoàn thành trễ hạn x1) - (đang trễ hạn x2) - (đang vướng mắc x1).",
          })],
        }),
        docxSimpleTable(
          ["#", "Nhân viên", "Được giao", "Hoàn thành", "Đúng hạn", "Đang trễ hạn", "Điểm KPI"],
          kpi.ranking.map((r) => [r.rank, r.name, r.assigned, `${r.completed} (${r.completionRate}%)`, r.completedOnTime, r.overdueOpen, r.score])
        ),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

/* ===================== Báo cáo CHI TIẾT toàn bộ công việc (làm cơ sở họp) ===================== */

const STATUS_LABEL_VI = {
  todo: "Chưa bắt đầu", doing: "Đang thực hiện", done: "Hoàn thành", blocked: "Tạm dừng/Vướng mắc",
};

function detailTable(headers, rows) {
  const widths = [6, 24, 13, 13, 10, 16, 10, 12, 8, 15]; // % cột, đủ cho tối đa 10 cột
  const mkCell = (text, bold, colIdx) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ""), bold: !!bold, size: 18 })] })],
    width: { size: widths[colIdx] || Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
  });
  const headerRow = new TableRow({ children: headers.map((h, i) => mkCell(h, true, i)) });
  const bodyRows = rows.map((row) => new TableRow({ children: row.map((c, i) => mkCell(c, false, i)) }));
  return new Table({ rows: [headerRow, ...bodyRows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

// groups: [{id, name, phaseLabel}], tasks: đã kèm sẵn assigneeName (string)
async function buildDetailedProjectDocx(projectName, groups, tasks) {
  const byGroup = new Map();
  tasks.forEach((t) => {
    if (!byGroup.has(t.group)) byGroup.set(t.group, []);
    byGroup.get(t.group).push(t);
  });

  const children = [
    new Paragraph({ text: "BAN DỰ ÁN - TCT CỔ PHẦN HỢP LỰC", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({
      text: `BÁO CÁO CHI TIẾT CÔNG VIỆC — ${projectName}`,
      heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: `(Tài liệu phục vụ họp giao ban — xuất lúc ${todayVN()})`, alignment: AlignmentType.CENTER }),
  ];

  let stt = 1;
  for (const g of groups) {
    const groupTasks = byGroup.get(g.id) || [];
    if (groupTasks.length === 0) continue;
    children.push(docxHeading(`${g.phaseLabel ? `[${g.phaseLabel}] ` : ""}${g.name}`, HeadingLevel.HEADING_2));
    children.push(
      detailTable(
        ["STT", "Tên công việc", "Đơn vị thực hiện", "Đơn vị phối hợp", "Thời gian dự kiến", "Căn cứ pháp lý", "Trạng thái", "Người phụ trách", "Hạn", "Ghi chú"],
        groupTasks.map((t) => [
          stt++, t.title || "(chưa đặt tên)", t.unitDo || "", t.unitCoord || "", t.duration || "",
          t.legal || "", STATUS_LABEL_VI[t.status] || t.status, t.assigneeName || "Chưa gán",
          t.due ? `${t.due}${t.dueLocked ? " (đã khoá)" : ""}` : "", t.note || "",
        ])
      )
    );
    children.push(new Paragraph({ text: "" }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

module.exports = {
  buildProjectReportPdf, buildProjectReportDocx,
  buildOverviewPdf, buildOverviewDocx,
  buildDetailedProjectDocx,
};
