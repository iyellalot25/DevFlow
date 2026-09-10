const express = require("express");
require("dotenv").config();
const pool = require("./db");

const app = express();
app.use(express.json());

// TEMPORARY: hardcoded team_id until auth exists (Phase 3)
const HARDCODED_TEAM_ID = 1;

// --Routes--

// PROJECTS

app.post("/projects", async (req, res) => {
  const { name, description } = req.body;

  //Validation
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO projects (team_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, team_id, name, description, created_at`,
      [HARDCODED_TEAM_ID, name.trim(), description || null],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/projects", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, team_id, name, description, created_at
       FROM projects
       WHERE team_id = $1
       ORDER BY created_at DESC`,
      [HARDCODED_TEAM_ID],
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// TASKS

app.post("/projects/:projectId/tasks", async (req, res) => {
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
    // Confirm project exists and belongs to this team
    const projectCheck = await pool.query(
      `SELECT id FROM projects WHERE id = $1 AND team_id = $2`,
      [projectId, HARDCODED_TEAM_ID],
    );
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    const result = await pool.query(
      `INSERT INTO tasks (project_id, raw_description)
       VALUES ($1, $2)
       RETURNING id, project_id, raw_description, status, created_at`,
      [projectId, raw_description.trim()],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/projects/:projectId/tasks", async (req, res) => {
  const { projectId } = req.params;

  try {
    const projectCheck = await pool.query(
      `SELECT id FROM projects WHERE id = $1 AND team_id = $2`,
      [projectId, HARDCODED_TEAM_ID],
    );
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    const result = await pool.query(
      `SELECT id, project_id, raw_description, status, created_at
       FROM tasks
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId],
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// SUBTASKS

const VALID_SUBTASK_STATUSES = ["todo", "in_progress", "done"];

app.post("/tasks/:taskId/subtasks", async (req, res) => {
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
    // Confirm task belongs to a project owned by this team
    const taskCheck = await pool.query(
      `SELECT t.id FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1 AND p.team_id = $2`,
      [taskId, HARDCODED_TEAM_ID],
    );
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const result = await pool.query(
      `INSERT INTO subtasks (task_id, description, position)
       VALUES ($1, $2, $3)
       RETURNING id, task_id, description, status, position, created_at`,
      [taskId, description.trim(), Number.isInteger(position) ? position : 0],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/tasks/:taskId/subtasks", async (req, res) => {
  const { taskId } = req.params;

  try {
    const taskCheck = await pool.query(
      `SELECT t.id FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1 AND p.team_id = $2`,
      [taskId, HARDCODED_TEAM_ID],
    );
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const result = await pool.query(
      `SELECT id, task_id, description, status, position, created_at
       FROM subtasks
       WHERE task_id = $1
       ORDER BY position ASC, created_at ASC`,
      [taskId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/subtasks/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  //Validation
  if (!status || !VALID_SUBTASK_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_SUBTASK_STATUSES.join(", ")}`,
    });
  }

  try {
    // Confirm subtask belongs to this team via task -> project chain
    const result = await pool.query(
      `UPDATE subtasks s
       SET status = $1
       FROM tasks t, projects p
       WHERE s.id = $2
         AND s.task_id = t.id
         AND t.project_id = p.id
         AND p.team_id = $3
       RETURNING s.id, s.task_id, s.description, s.status, s.position, s.created_at`,
      [status, id, HARDCODED_TEAM_ID],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subtask not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// START LISTENING
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DevFlow listening on port ${PORT}`);
});
