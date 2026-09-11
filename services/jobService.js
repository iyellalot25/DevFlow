const pool = require("../db");

async function createJob(taskId) {
  const result = await pool.query(
    `INSERT INTO decomposition_jobs (task_id, status)
     VALUES ($1, 'pending')
     RETURNING id, task_id, status, result, error, created_at, completed_at`,
    [taskId],
  );
  return result.rows[0];
}

async function getJobForTeam(jobId, teamId) {
  const result = await pool.query(
    `SELECT j.id, j.task_id, j.status, j.result, j.error, j.created_at, j.completed_at
     FROM decomposition_jobs j
     JOIN tasks t ON t.id = j.task_id
     JOIN projects p ON p.id = t.project_id
     WHERE j.id = $1 AND p.team_id = $2`,
    [jobId, teamId],
  );
  return result.rows[0] || null;
}

async function claimNextPendingJob() {
  // FOR UPDATE SKIP LOCKED: safe even if multiple worker loops ever run,
  // avoids two workers claiming the same job.
  const client = await pool.connect();
  try {
    //Transaction
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, task_id FROM decomposition_jobs
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const job = result.rows[0];
    await client.query(
      `UPDATE decomposition_jobs SET status = 'processing' WHERE id = $1`,
      [job.id],
    );
    await client.query("COMMIT");
    return job;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function completeJob(jobId, resultPayload, usage = {}) {
  await pool.query(
    `UPDATE decomposition_jobs
     SET status = 'done',
         result = $1,
         completed_at = now(),
         prompt_tokens = $2,
         completion_tokens = $3,
         model_name = $4
     WHERE id = $5`,
    [
      JSON.stringify(resultPayload.subtasks || resultPayload),
      usage.promptTokens ?? null,
      usage.completionTokens ?? null,
      usage.modelName ?? null,
      jobId,
    ],
  );
}

async function failJob(jobId, errorMessage) {
  await pool.query(
    `UPDATE decomposition_jobs
     SET status = 'failed', error = $1, completed_at = now()
     WHERE id = $2`,
    [errorMessage, jobId],
  );
}

module.exports = {
  createJob,
  getJobForTeam,
  claimNextPendingJob,
  completeJob,
  failJob,
};
