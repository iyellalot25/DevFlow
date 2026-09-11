const express = require("express");
const router = express.Router();
const projectService = require("../services/projectService");

const HARDCODED_TEAM_ID = 1; // TODO: replace with req.user.team_id in Phase 3

router.post("/", async (req, res) => {
  const { name, description } = req.body;

  //Validation
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const project = await projectService.createProject(
      HARDCODED_TEAM_ID,
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
    const projects = await projectService.listProjects(HARDCODED_TEAM_ID);
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
module.exports.HARDCODED_TEAM_ID = HARDCODED_TEAM_ID;
