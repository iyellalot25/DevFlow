const express = require("express");
const router = express.Router();
const taskService = require("../services/taskService");
const projectService = require("../services/projectService");
const sseService = require("../services/sseService");
const requireAuth = require("../middleware/auth");

router.use(requireAuth);

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
      req.user.team_id,
    );
    if (!exists) return res.status(404).json({ error: "Project not found" });

    const task = await taskService.createTask(
      projectId,
      raw_description.trim(),
    );
    sseService.broadcast(req.user.team_id, "tasks:changed");
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
      req.user.team_id,
    );
    if (!exists) return res.status(404).json({ error: "Project not found" });

    const tasks = await taskService.listTasksForProject(projectId);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { raw_description } = req.body;

  if (
    raw_description !== undefined &&
    (typeof raw_description !== "string" || raw_description.trim() === "")
  ) {
    return res
      .status(400)
      .json({ error: "raw_description must be a non-empty string" });
  }

  try {
    const exists = await taskService.taskExistsForTeam(id, req.user.team_id);
    if (!exists) return res.status(404).json({ error: "Task not found" });

    const updated = await taskService.updateTask(
      id,
      raw_description ? raw_description.trim() : undefined,
    );
    sseService.broadcast(req.user.team_id, "tasks:changed");
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const exists = await taskService.taskExistsForTeam(id, req.user.team_id);
    if (!exists) return res.status(404).json({ error: "Task not found" });

    await taskService.deleteTask(id);
    sseService.broadcast(req.user.team_id, "tasks:changed");
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
