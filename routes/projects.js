const express = require("express");
const router = express.Router();
const projectService = require("../services/projectService");
const sseService = require("../services/sseService");
const requireAuth = require("../middleware/auth");

//Use auth middleware
router.use(requireAuth);

router.post("/", async (req, res) => {
  const { name, description } = req.body;

  //Validation
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const project = await projectService.createProject(
      req.user.team_id,
      name.trim(),
      description,
    );
    sseService.broadcast(req.user.team_id, "projects:changed");
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const projects = await projectService.listProjects(req.user.team_id);
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
    return res.status(400).json({ error: "name must be a non-empty string" });
  }

  try {
    const exists = await projectService.projectExistsForTeam(
      id,
      req.user.team_id,
    );
    if (!exists) return res.status(404).json({ error: "Project not found" });

    const updated = await projectService.updateProject(
      id,
      name ? name.trim() : undefined,
      description,
    );
    sseService.broadcast(req.user.team_id, "projects:changed");
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const exists = await projectService.projectExistsForTeam(
      id,
      req.user.team_id,
    );
    if (!exists) return res.status(404).json({ error: "Project not found" });

    await projectService.deleteProject(id);
    sseService.broadcast(req.user.team_id, "projects:changed");
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
