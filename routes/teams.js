const express = require("express");
const router = express.Router();
const teamService = require("../services/teamService");
const authService = require("../services/authService");
const requireAuth = require("../middleware/auth");

const isProd = process.env.NODE_ENV === "production";

/**
 * Helper function to set the updated JWT access token in an HTTP-only cookie.
 * Ensures the client session stays in sync immediately when team ownership/membership changes.
 */
function setAccessTokenCookie(res, token) {
  res.cookie("devflow_token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 1000, // 1 hour (matches JWT expiration duration)
  });
}

router.use(requireAuth);

router.get("/teams/me", async (req, res) => {
  try {
    const team = await teamService.getTeamWithMembers(req.user.team_id);
    if (!team) return res.status(404).json({ error: "Team not found" });

    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/teams/join", async (req, res) => {
  const { join_code } = req.body;

  // Validate presence and type of join code input
  if (!join_code || typeof join_code !== "string") {
    return res.status(400).json({ error: "join_code is required" });
  }

  const normalizedCode = join_code.trim().toUpperCase();

  try {
    // Verify join code existence
    const team = await teamService.findTeamByJoinCode(normalizedCode);
    if (!team) {
      return res.status(400).json({ error: "Invalid join code" });
    }

    // Prevent re-joining current team
    if (team.id === req.user.team_id) {
      return res
        .status(400)
        .json({ error: "You are already a member of this team" });
    }

    // Move user to the target team
    await teamService.joinTeamByCode(req.user.user_id, normalizedCode);

    // Reissue access token immediately so the active session reflects
    // the new team ID without waiting for old token expiration or refresh flow.
    const token = authService.generateToken({
      id: req.user.user_id,
      team_id: team.id,
      email: req.user.email,
    });
    setAccessTokenCookie(res, token);

    res.json({ ok: true, team_id: team.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/teams/leave", async (req, res) => {
  try {
    const newTeam = await teamService.leaveTeam(
      req.user.user_id,
      req.user.email,
    );

    // Issue updated token containing the newly generated team ID
    const token = authService.generateToken({
      id: req.user.user_id,
      team_id: newTeam.id,
      email: req.user.email,
    });
    setAccessTokenCookie(res, token);

    res.json({ ok: true, team: newTeam });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/teams/members/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const team = await teamService.getTeamWithMembers(req.user.team_id);
    if (!team) return res.status(404).json({ error: "Team not found" });

    // Authorization: Only original team creator can remove members
    if (team.created_by !== req.user.user_id) {
      return res
        .status(403)
        .json({ error: "Only the team creator can remove members" });
    }

    // Prevent creator from deleting self via this route (must use /teams/leave)
    if (Number(userId) === req.user.user_id) {
      return res
        .status(400)
        .json({ error: "Use /teams/leave to remove yourself" });
    }

    // Check if target user actually exists within the creator's team
    const target = team.members.find((m) => m.id === Number(userId));
    if (!target) {
      return res.status(404).json({ error: "That user is not on your team" });
    }

    // Remove targeted member into their own new solo team
    await teamService.removeMember(target.id, target.email);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/teams/regenerate-code", async (req, res) => {
  try {
    const team = await teamService.getTeamWithMembers(req.user.team_id);
    if (!team) return res.status(404).json({ error: "Team not found" });

    // Authorization check
    if (team.created_by !== req.user.user_id) {
      return res
        .status(403)
        .json({ error: "Only the team creator can regenerate the join code" });
    }

    const updated = await teamService.regenerateJoinCode(req.user.team_id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/teams/gemini-key", async (req, res) => {
  const { api_key } = req.body;

  if (!api_key || typeof api_key !== "string" || api_key.trim().length < 10) {
    return res.status(400).json({ error: "A valid api_key is required" });
  }

  try {
    const team = await teamService.getTeamWithMembers(req.user.team_id);
    if (!team) return res.status(404).json({ error: "Team not found" });

    if (team.created_by !== req.user.user_id) {
      return res.status(403).json({
        error: "Only the team creator can set the team's Gemini API key",
      });
    }

    await teamService.setGeminiKey(req.user.team_id, api_key.trim());
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/teams/gemini-key", async (req, res) => {
  try {
    const team = await teamService.getTeamWithMembers(req.user.team_id);
    if (!team) return res.status(404).json({ error: "Team not found" });

    if (team.created_by !== req.user.user_id) {
      return res.status(403).json({
        error: "Only the team creator can remove the team's Gemini API key",
      });
    }

    await teamService.removeGeminiKey(req.user.team_id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
