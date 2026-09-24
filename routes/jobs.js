const express = require("express");
const router = express.Router();
const jobService = require("../services/jobService");
const taskService = require("../services/taskService");
const usageService = require("../services/usageService");
const requireAuth = require("../middleware/auth");

router.use(requireAuth);

router.post("/tasks/:taskId/decompose", async (req, res) => {
  const { taskId } = req.params;

  try {
    const exists = await taskService.taskExistsForTeam(
      taskId,
      req.user.team_id,
    );
    if (!exists) return res.status(404).json({ error: "Task not found" });

    const underQuota = await usageService.isUnderQuota(req.user.team_id);
    if (!underQuota) {
      return res.status(429).json({
        error: `Daily decomposition limit reached (${usageService.DAILY_QUOTA}/day per team). Try again tomorrow.`,
      });
    }

    const job = await jobService.createJob(taskId);
    res.status(202).json(job); // 202 Accepted: work queued, not done yet
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/jobs/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const job = await jobService.getJobForTeam(id, req.user.team_id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/usage", async (req, res) => {
  try {
    const usage = await usageService.getTeamUsage(req.user.team_id);
    res.json(usage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
