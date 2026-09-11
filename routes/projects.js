const express = require("express");
const router = express.Router();
const projectService = require("../services/projectService");
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

module.exports = router;
