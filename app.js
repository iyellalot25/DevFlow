const express = require("express");
require("dotenv").config();

const authRouter = require("./routes/auth");
const projectsRouter = require("./routes/projects");
const tasksRouter = require("./routes/tasks");
const subtasksRouter = require("./routes/subtasks");
const jobsRouter = require("./routes/jobs");
const startWorker = require("./worker");

const app = express();
app.use(express.json());

// ROUTES
app.use("/auth", authRouter);
app.use("/projects", projectsRouter);
app.use("/", tasksRouter);
app.use("/", subtasksRouter);
app.use("/", jobsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DevFlow listening on port ${PORT}`);
  startWorker();
});
