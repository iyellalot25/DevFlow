const express = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const pool = require("./db");
const authRouter = require("./routes/auth");
const projectsRouter = require("./routes/projects");
const tasksRouter = require("./routes/tasks");
const subtasksRouter = require("./routes/subtasks");
const jobsRouter = require("./routes/jobs");
const startWorker = require("./worker");
const reportsRouter = require("./routes/reports");
const teamsRouter = require("./routes/teams");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    console.error("[health] DB check failed:", err.message);
    res.status(503).json({ status: "error", error: "Database unreachable" });
  }
});

// ROUTES
app.use("/auth", authRouter);
app.use("/projects", projectsRouter);
app.use("/", tasksRouter);
app.use("/", subtasksRouter);
app.use("/", jobsRouter);
app.use("/", reportsRouter);
app.use("/", teamsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DevFlow listening on port ${PORT}`);
  startWorker();
});
