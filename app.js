const express = require("express");
require("dotenv").config();
const pool = require("./db");

const app = express();
app.use(express.json());

// TEMPORARY: hardcoded team_id until auth exists (Phase 3)
const HARDCODED_TEAM_ID = 1;

//Routes
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DevFlow listening on port ${PORT}`);
});
