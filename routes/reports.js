const express = require("express");
const router = express.Router();
const reportService = require("../services/reportService");
const { generateProjectReportPDF } = require("../services/pdfService");
const requireAuth = require("../middleware/auth");

router.use(requireAuth);

router.get("/reports/:projectId/pdf", async (req, res) => {
  const { projectId } = req.params;

  try {
    const reportData = await reportService.getProjectReportData(
      projectId,
      req.user.team_id,
    );
    if (!reportData) {
      return res.status(404).json({ error: "Project not found" });
    }

    const safeName = reportData.project.name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="devflow-report-${safeName}.pdf"`,
    );

    generateProjectReportPDF(reportData, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

module.exports = router;
