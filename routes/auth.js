const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const authService = require("../services/authService");
const teamService = require("../services/teamService");
const requireAuth = require("../middleware/auth");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isProd = process.env.NODE_ENV === "production";

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
});

function setAuthCookies(res, token, refreshToken) {
  res.cookie("devflow_token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 1000, // 1h, matches JWT_EXPIRY
  });
  res.cookie("devflow_refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/auth/refresh", // only ever sent to this one endpoint
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

router.post("/register", authRateLimiter, async (req, res) => {
  const { email, password, join_code } = req.body;

  //Validation
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }

  try {
    const existing = await authService.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    let existingTeamId = null;
    if (join_code) {
      if (typeof join_code !== "string") {
        return res.status(400).json({ error: "join_code must be a string" });
      }
      const team = await teamService.findTeamByJoinCode(
        join_code.trim().toUpperCase(),
      );
      if (!team) {
        return res.status(400).json({ error: "Invalid join code" });
      }
      existingTeamId = team.id;
    }

    const user = await authService.registerUser(
      email,
      password,
      existingTeamId,
    );
    const token = authService.generateToken(user);
    const refreshToken = await authService.issueRefreshToken(user.id);

    setAuthCookies(res, token, refreshToken);

    res.status(201).json({
      user: { id: user.id, email: user.email, team_id: user.team_id },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", authRateLimiter, async (req, res) => {
  const { email, password } = req.body;

  //Validation
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const user = await authService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await authService.verifyPassword(
      password,
      user.password_hash,
    );
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = authService.generateToken(user);
    const refreshToken = await authService.issueRefreshToken(user.id);

    setAuthCookies(res, token, refreshToken);

    res.json({
      user: { id: user.id, email: user.email, team_id: user.team_id },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies && req.cookies.devflow_refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token" });
  }

  try {
    const user = await authService.verifyRefreshToken(refreshToken);
    if (!user) {
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    const token = authService.generateToken(user);
    res.cookie("devflow_token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies && req.cookies.devflow_refresh_token;
  try {
    if (refreshToken) await authService.revokeRefreshToken(refreshToken);
  } catch (err) {
    console.error(err);
  }
  res.clearCookie("devflow_token");
  res.clearCookie("devflow_refresh_token", { path: "/auth/refresh" });
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
