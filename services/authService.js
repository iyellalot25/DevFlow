const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db");
const { generateJoinCode } = require("./teamService");

const SALT_ROUNDS = 10;
const JWT_EXPIRY = "1h";
const REFRESH_TOKEN_TTL_DAYS = 7;

// existingTeamId: pass a team id to join that team instead of creating a
// new one (used when a valid join_code was provided at registration).
async function registerUser(email, password, existingTeamId = null) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    //Transaction Safety
    await client.query("BEGIN");

    let teamId = existingTeamId;

    if (!teamId) {
      const newJoinCode = generateJoinCode();
      const teamResult = await client.query(
        `INSERT INTO teams (name, join_code) VALUES ($1, $2) RETURNING id`,
        [`${email}'s team`, newJoinCode],
      );
      teamId = teamResult.rows[0].id;
    }

    const userResult = await client.query(
      `INSERT INTO users (team_id, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, team_id, email, created_at`,
      [teamId, email, passwordHash],
    );

    // Only the creator of a brand-new team gets removal rights on it —
    // someone joining an existing team via join_code is just a member.
    if (!existingTeamId) {
      await client.query(`UPDATE teams SET created_by = $1 WHERE id = $2`, [
        userResult.rows[0].id,
        teamId,
      ]);
    }

    await client.query("COMMIT");
    return userResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT id, team_id, email, password_hash, created_at
     FROM users WHERE email = $1`,
    [email],
  );
  return result.rows[0] || null;
}

async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

function generateToken(user) {
  return jwt.sign(
    { user_id: user.id, team_id: user.team_id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueRefreshToken(userId) {
  const plainToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashRefreshToken(plainToken);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '${REFRESH_TOKEN_TTL_DAYS} days')`,
    [userId, tokenHash],
  );

  return plainToken;
}

async function verifyRefreshToken(plainToken) {
  const tokenHash = hashRefreshToken(plainToken);

  const result = await pool.query(
    `SELECT u.id, u.team_id, u.email
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1
       AND rt.revoked_at IS NULL
       AND rt.expires_at > now()`,
    [tokenHash],
  );

  return result.rows[0] || null;
}

async function revokeRefreshToken(plainToken) {
  const tokenHash = hashRefreshToken(plainToken);
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
}

module.exports = {
  registerUser,
  findUserByEmail,
  verifyPassword,
  generateToken,
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
};
