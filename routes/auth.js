const express = require("express");
const router = express.Router();
const authService = require("../services/authService");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

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

    const user = await authService.registerUser(email, password);
    const token = authService.generateToken(user);
    const refresh_token = await authService.issueRefreshToken(user.id);

    res.status(201).json({
      user: { id: user.id, email: user.email, team_id: user.team_id },
      token,
      refresh_token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
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
    const refresh_token = await authService.issueRefreshToken(user.id);
    res.json({
      user: { id: user.id, email: user.email, team_id: user.team_id },
      token,
      refresh_token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/refresh", async (req, res) => {
  const { refresh_token } = req.body;

  //Validation
  if (!refresh_token || typeof refresh_token !== "string") {
    return res.status(400).json({ error: "refresh_token is required" });
  }

  try {
    const user = await authService.verifyRefreshToken(refresh_token);
    if (!user) {
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    const token = authService.generateToken(user);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
