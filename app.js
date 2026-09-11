const express = require("express");
require("dotenv").config();

const authRouter = require("./routes/auth");
const projectsRouter = require("./routes/projects");
const tasksRouter = require("./routes/tasks");
const subtasksRouter = require("./routes/subtasks");

const app = express();
app.use(express.json());

//ROUTES
app.use("/auth", authRouter);
app.use("/projects", projectsRouter);
app.use("/", tasksRouter);
app.use("/", subtasksRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DevFlow listening on port ${PORT}`);
});
