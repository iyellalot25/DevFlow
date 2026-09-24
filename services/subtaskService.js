const pool = require("../db");

const VALID_SUBTASK_STATUSES = ["todo", "in_progress", "done"];

async function createSubtask(taskId, description, position) {
  const result = await pool.query(
    `INSERT INTO subtasks (task_id, description, position)
     VALUES ($1, $2, $3)
     RETURNING id, task_id, description, status, position, created_at`,
    [taskId, description, Number.isInteger(position) ? position : 0],
  );
  return result.rows[0];
}

async function listSubtasksForTask(taskId) {
  const result = await pool.query(
    `SELECT id, task_id, description, status, position, created_at
     FROM subtasks
     WHERE task_id = $1
     ORDER BY position ASC, created_at ASC`,
    [taskId],
  );
  return result.rows;
}

async function updateSubtaskStatus(subtaskId, status, teamId) {
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
    [status, subtaskId, teamId],
  );
  return result.rows[0] || null;
}

async function deleteSubtask(subtaskId, teamId) {
  const result = await pool.query(
    `DELETE FROM subtasks s
     USING tasks t, projects p
     WHERE s.id = $1
       AND s.task_id = t.id
       AND t.project_id = p.id
       AND p.team_id = $2
     RETURNING s.id`,
    [subtaskId, teamId],
  );
  return result.rows.length > 0;
}

module.exports = {
  createSubtask,
  listSubtasksForTask,
  updateSubtaskStatus,
  deleteSubtask,
  VALID_SUBTASK_STATUSES,
};
