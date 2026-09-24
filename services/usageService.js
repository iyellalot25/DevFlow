const pool = require("../db");

const DAILY_QUOTA = 50;

async function getTeamUsage(teamId) {
  const todayResult = await pool.query(
    `SELECT count(*)::int AS count
     FROM decomposition_jobs dj
     JOIN tasks t ON t.id = dj.task_id
     JOIN projects p ON p.id = t.project_id
     WHERE p.team_id = $1
       AND dj.created_at >= date_trunc('day', now())`,
    [teamId],
  );

  const totalsResult = await pool.query(
    `SELECT
       count(*)::int AS jobs_total,
       count(*) FILTER (WHERE dj.status = 'done')::int AS jobs_done,
       count(*) FILTER (WHERE dj.status = 'failed')::int AS jobs_failed,
       count(*) FILTER (WHERE dj.status IN ('pending', 'processing'))::int AS jobs_in_progress,
       COALESCE(SUM(dj.prompt_tokens), 0)::int AS total_prompt_tokens,
       COALESCE(SUM(dj.completion_tokens), 0)::int AS total_completion_tokens
     FROM decomposition_jobs dj
     JOIN tasks t ON t.id = dj.task_id
     JOIN projects p ON p.id = t.project_id
     WHERE p.team_id = $1`,
    [teamId],
  );

  return {
    quota_limit: DAILY_QUOTA,
    used_today: todayResult.rows[0].count,
    remaining_today: Math.max(0, DAILY_QUOTA - todayResult.rows[0].count),
    ...totalsResult.rows[0],
  };
}

async function isUnderQuota(teamId) {
  const usage = await getTeamUsage(teamId);
  return usage.remaining_today > 0;
}

module.exports = { getTeamUsage, isUnderQuota, DAILY_QUOTA };
