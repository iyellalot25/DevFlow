const pool = require("../db");

async function createProject(teamId, name, description) {
  const result = await pool.query(
    `INSERT INTO projects (team_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, team_id, name, description, created_at`,
    [teamId, name, description || null],
  );
  return result.rows[0];
}

async function listProjects(teamId) {
  const result = await pool.query(
    `SELECT id, team_id, name, description, created_at
     FROM projects
     WHERE team_id = $1
     ORDER BY created_at DESC`,
    [teamId],
  );
  return result.rows;
}

async function projectExistsForTeam(projectId, teamId) {
  const result = await pool.query(
    `SELECT id FROM projects WHERE id = $1 AND team_id = $2`,
    [projectId, teamId],
  );
  return result.rows.length > 0;
}

module.exports = { createProject, listProjects, projectExistsForTeam };
