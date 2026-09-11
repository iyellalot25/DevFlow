const pool = require("../db");

async function createTask(projectId, rawDescription) {
  const result = await pool.query(
    `INSERT INTO tasks (project_id, raw_description)
     VALUES ($1, $2)
     RETURNING id, project_id, raw_description, status, created_at`,
    [projectId, rawDescription],
  );
  return result.rows[0];
}

async function listTasksForProject(projectId) {
  const result = await pool.query(
    `SELECT id, project_id, raw_description, status, created_at
     FROM tasks
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId],
  );
  return result.rows;
}

async function taskExistsForTeam(taskId, teamId) {
  const result = await pool.query(
    `SELECT t.id FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1 AND p.team_id = $2`,
    [taskId, teamId],
  );
  return result.rows.length > 0;
}

module.exports = { createTask, listTasksForProject, taskExistsForTeam };
