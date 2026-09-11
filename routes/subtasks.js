const express = require("express");
const router = express.Router();
const subtaskService = require("../services/subtaskService");
const taskService = require("../services/taskService");
const { HARDCODED_TEAM_ID } = require("./projects");

router.post("/tasks/:taskId/subtasks", async (req, res) => {
  const { taskId } = req.params;
  const { description, position } = req.body;

  //Validation
  if (
    !description ||
    typeof description !== "string" ||
    description.trim() === ""
  ) {
    return res.status(400).json({ error: "description is required" });
  }

  try {
    const exists = await taskService.taskExistsForTeam(
      taskId,
      HARDCODED_TEAM_ID,
    );
    if (!exists) return res.status(404).json({ error: "Task not found" });

    const subtask = await subtaskService.createSubtask(
      taskId,
      description.trim(),
      position,
    );
    res.status(201).json(subtask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tasks/:taskId/subtasks", async (req, res) => {
  const { taskId } = req.params;

  try {
    const exists = await taskService.taskExistsForTeam(
      taskId,
      HARDCODED_TEAM_ID,
    );
    if (!exists) return res.status(404).json({ error: "Task not found" });

    const subtasks = await subtaskService.listSubtasksForTask(taskId);
    res.json(subtasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/subtasks/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  //Validation
  if (!status || !subtaskService.VALID_SUBTASK_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${subtaskService.VALID_SUBTASK_STATUSES.join(", ")}`,
    });
  }

  try {
    const updated = await subtaskService.updateSubtaskStatus(
      id,
      status,
      HARDCODED_TEAM_ID,
    );
    if (!updated) return res.status(404).json({ error: "Subtask not found" });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
