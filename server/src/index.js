require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const reportRoutes = require("./routes/reports");
const zaloRoutes = require("./routes/zalo");
const { startReminderScheduler } = require("./reminders");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/zalo", zaloRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Serve built frontend (production: `npm run build` in /client copies dist here)
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) res.status(404).send("Chưa có bản build của giao diện. Chạy 'npm run build' trong thư mục client trước.");
  });
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  startReminderScheduler();
});
