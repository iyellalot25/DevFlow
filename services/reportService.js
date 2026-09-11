const pool = require("../db");

async function getProjectReportData(projectId, teamId) {
  //Get project
  const projectResult = await pool.query(
    `SELECT id, name, description, created_at
     FROM projects WHERE id = $1 AND team_id = $2`,
    [projectId, teamId],
  );

  if (projectResult.rows.length === 0) {
    return null;
  }
  const project = projectResult.rows[0];

  //Get tasks
  const tasksResult = await pool.query(
    `SELECT id, raw_description, status, created_at
     FROM tasks WHERE project_id = $1
     ORDER BY created_at ASC`,
    [projectId],
  );

  const tasks = [];
  let totalSubtasks = 0;
  let totalDone = 0;

  //Get subtasks
  for (const task of tasksResult.rows) {
    const subtasksResult = await pool.query(
      `SELECT id, description, status, position
       FROM subtasks WHERE task_id = $1
       ORDER BY position ASC`,
      [task.id],
    );
    const subtasks = subtasksResult.rows;
    const doneCount = subtasks.filter((s) => s.status === "done").length;

    totalSubtasks += subtasks.length;
    totalDone += doneCount;

    tasks.push({
      ...task,
      subtasks,
      subtaskCount: subtasks.length,
      doneCount,
      percentComplete:
        subtasks.length > 0
          ? Math.round((doneCount / subtasks.length) * 100)
          : 0,
    });
  }

  const overallPercent =
    totalSubtasks > 0 ? Math.round((totalDone / totalSubtasks) * 100) : 0;

  return {
    project,
    tasks,
    totalSubtasks,
    totalDone,
    overallPercent,
    generatedAt: new Date(),
  };
}

module.exports = { getProjectReportData };
