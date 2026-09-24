const pool = require("../db");
const crypto = require("crypto");
const { encrypt, decrypt } = require("./cryptoService");

function generateJoinCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
}

async function findTeamByJoinCode(joinCode) {
  const result = await pool.query(
    `SELECT id, name, join_code, created_by FROM teams WHERE join_code = $1`,
    [joinCode],
  );
  return result.rows[0] || null;
}

async function getTeamWithMembers(teamId) {
  const teamResult = await pool.query(
    `SELECT id, name, join_code, created_by,
            (gemini_api_key_encrypted IS NOT NULL) AS has_custom_gemini_key
     FROM teams WHERE id = $1`,
    [teamId],
  );
  const team = teamResult.rows[0];
  if (!team) return null;

  const membersResult = await pool.query(
    `SELECT id, email FROM users WHERE team_id = $1 ORDER BY created_at ASC`,
    [teamId],
  );

  return {
    id: team.id,
    name: team.name,
    join_code: team.join_code,
    created_by: team.created_by,
    has_custom_gemini_key: team.has_custom_gemini_key,
    members: membersResult.rows,
  };
}

// The plaintext key is only ever decrypted server-side, right before an
// LLM call — it is never sent back to any client.
async function setGeminiKey(teamId, plainKey) {
  const encrypted = encrypt(plainKey);
  // usage_reset_at gives the team a fresh daily quota window starting now,
  // rather than inheriting whatever was already used against the shared key.
  await pool.query(
    `UPDATE teams
     SET gemini_api_key_encrypted = $1, usage_reset_at = now()
     WHERE id = $2`,
    [encrypted, teamId],
  );
}

async function removeGeminiKey(teamId) {
  await pool.query(
    `UPDATE teams SET gemini_api_key_encrypted = NULL WHERE id = $1`,
    [teamId],
  );
}

async function getDecryptedGeminiKey(teamId) {
  const result = await pool.query(
    `SELECT gemini_api_key_encrypted FROM teams WHERE id = $1`,
    [teamId],
  );
  const row = result.rows[0];
  if (!row || !row.gemini_api_key_encrypted) return null;

  try {
    return decrypt(row.gemini_api_key_encrypted);
  } catch (err) {
    console.error(
      `[teamService] failed to decrypt gemini key for team ${teamId}, falling back to shared key:`,
      err.message,
    );
    return null;
  }
}

// Moves a user into targetTeamId. If their old team has zero members left
// afterward the old team (and its projects/tasks/subtasks) is deleted via
// cascade
async function moveUserToTeam(userId, targetTeamId, client) {
  const ownClient = !client;
  const c = client || (await pool.connect());
  try {
    if (ownClient) await c.query("BEGIN");

    const userResult = await c.query(
      `SELECT team_id FROM users WHERE id = $1`,
      [userId],
    );
    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }
    const oldTeamId = userResult.rows[0].team_id;

    // 1. Re-assign user to new team
    await c.query(`UPDATE users SET team_id = $1 WHERE id = $2`, [
      targetTeamId,
      userId,
    ]);

    // 2. Check remaining members on old team
    const remaining = await c.query(
      `SELECT count(*)::int AS count FROM users WHERE team_id = $1`,
      [oldTeamId],
    );

    // 3. Delete old team if 0 members remain (projects/tasks cascade delete via projects_team_id_fkey)
    if (remaining.rows[0].count === 0) {
      await c.query(`DELETE FROM teams WHERE id = $1`, [oldTeamId]);
    }

    if (ownClient) await c.query("COMMIT");
  } catch (err) {
    if (ownClient) await c.query("ROLLBACK");
    throw err;
  } finally {
    if (ownClient) c.release();
  }
}

async function leaveTeam(userId, userEmail) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const newJoinCode = generateJoinCode();

    // Create new solo team for the leaving user
    const teamResult = await client.query(
      `INSERT INTO teams (name, join_code, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, join_code, created_by`,
      [`${userEmail}'s team`, newJoinCode, userId],
    );
    const newTeam = teamResult.rows[0];

    // Reuse moveUserToTeam within the active client transaction
    await moveUserToTeam(userId, newTeam.id, client);

    await client.query("COMMIT");
    return newTeam;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function joinTeamByCode(userId, joinCode) {
  const team = await findTeamByJoinCode(joinCode);
  if (!team) return null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await moveUserToTeam(userId, team.id, client);
    await client.query("COMMIT");
    return team;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Removes targetUserId from their team, giving them a fresh solo team of
// their own — same underlying effect as if they'd left voluntarily.
async function removeMember(targetUserId, targetEmail) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const newJoinCode = generateJoinCode();
    const teamResult = await client.query(
      `INSERT INTO teams (name, join_code, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [`${targetEmail}'s team`, newJoinCode, targetUserId],
    );
    const newTeamId = teamResult.rows[0].id;

    await moveUserToTeam(targetUserId, newTeamId, client);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function regenerateJoinCode(teamId) {
  const newJoinCode = generateJoinCode();
  const result = await pool.query(
    `UPDATE teams SET join_code = $1 WHERE id = $2 RETURNING id, join_code`,
    [newJoinCode, teamId],
  );
  return result.rows[0] || null;
}

module.exports = {
  generateJoinCode,
  findTeamByJoinCode,
  getTeamWithMembers,
  moveUserToTeam,
  leaveTeam,
  joinTeamByCode,
  removeMember,
  regenerateJoinCode,
  setGeminiKey,
  removeGeminiKey,
  getDecryptedGeminiKey,
};
