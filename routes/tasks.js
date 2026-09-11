const express = require("express");
const router = express.Router();
const taskService = require("../services/taskService");
const projectService = require("../services/projectService");
const { HARDCODED_TEAM_ID } = require("./projects");

router.post("/projects/:projectId/tasks", async (req, res) => {
  const { projectId } = req.params;
  const { raw_description } = req.body;

  //Validation
  if (
    !raw_description ||
    typeof raw_description !== "string" ||
    raw_description.trim() === ""
  ) {
    return res.status(400).json({ error: "raw_description is required" });
  }

  try {
    const exists = await projectService.projectExistsForTeam(
      projectId,
      HARDCODED_TEAM_ID,
    );
    if (!exists) return res.status(404).json({ error: "Project not found" });

    const task = await taskService.createTask(
      projectId,
      raw_description.trim(),
    );
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects/:projectId/tasks", async (req, res) => {
  const { projectId } = req.params;

  try {
    const exists = await projectService.projectExistsForTeam(
      projectId,
      HARDCODED_TEAM_ID,
    );
    if (!exists) return res.status(404).json({ error: "Project not found" });

    const tasks = await taskService.listTasksForProject(projectId);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
