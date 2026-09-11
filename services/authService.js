const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const SALT_ROUNDS = 10;
const JWT_EXPIRY = "6h";

async function registerUser(email, password) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    //Transaction Safety
    await client.query("BEGIN");

    const teamResult = await client.query(
      `INSERT INTO teams (name) VALUES ($1) RETURNING id`,
      [`${email}'s team`],
    );
    const teamId = teamResult.rows[0].id;

    const userResult = await client.query(
      `INSERT INTO users (team_id, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, team_id, email, created_at`,
      [teamId, email, passwordHash],
    );

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

module.exports = {
  registerUser,
  findUserByEmail,
  verifyPassword,
  generateToken,
};
