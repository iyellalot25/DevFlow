const express = require("express");
require("dotenv").config();

const projectsRouter = require("./routes/projects");
const tasksRouter = require("./routes/tasks");
const subtasksRouter = require("./routes/subtasks");

const app = express();
app.use(express.json());

// ROUTES
app.use("/projects", projectsRouter);
app.use("/", tasksRouter);
app.use("/", subtasksRouter);

//START LISTENING
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DevFlow listening on port ${PORT}`);
});
