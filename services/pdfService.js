const PDFDocument = require("pdfkit");

const COLORS = {
  ink: "#14181f",
  inkMuted: "#5b6270",
  blueprint: "#1b3a6b",
  slate: "#d7dce3",
  slateLight: "#eceef1",
  moss: "#2f6f62",
  ochre: "#b8792e",
  gray: "#6b7280",
  white: "#ffffff",
};

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 612; // Letter width in points
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

function generateProjectReportPDF(reportData, stream) {
  const doc = new PDFDocument({ margin: PAGE_MARGIN, size: "LETTER" });
  doc.pipe(stream);

  const {
    project,
    tasks,
    totalSubtasks,
    totalDone,
    totalInProgress,
    totalTodo,
    overallPercent,
    generatedAt,
  } = reportData;

  drawHeader(doc, generatedAt);
  drawProjectSummary(doc, project, {
    totalSubtasks,
    totalDone,
    totalInProgress,
    totalTodo,
    overallPercent,
    taskCount: tasks.length,
  });

  if (tasks.length === 0) {
    doc
      .fontSize(11)
      .fillColor(COLORS.inkMuted)
      .font("Helvetica-Oblique")
      .text("No tasks yet in this project.");
  }

  for (const task of tasks) {
    drawTaskBlock(doc, task);
  }

  doc.end();
}

function drawHeader(doc, generatedAt) {
  // Top accent band
  doc.rect(0, 0, PAGE_WIDTH, 6).fill(COLORS.blueprint);

  doc
    .fontSize(11)
    .font("Courier")
    .fillColor(COLORS.inkMuted)
    .text("DEVFLOW · PROJECT PROGRESS REPORT", PAGE_MARGIN, 30);

  doc
    .fontSize(9)
    .font("Courier")
    .fillColor(COLORS.inkMuted)
    .text(`Generated ${generatedAt.toLocaleString()}`, PAGE_MARGIN, 30, {
      width: CONTENT_WIDTH,
      align: "right",
    });

  doc.y = 55;
}

function drawProjectSummary(doc, project, stats) {
  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .fillColor(COLORS.ink)
    .text(project.name, PAGE_MARGIN, doc.y);

  if (project.description) {
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor(COLORS.inkMuted)
      .text(project.description);
  }

  doc.moveDown(0.8);

  // Stat row: tasks / done / in progress / todo
  const statY = doc.y;
  const statBoxWidth = CONTENT_WIDTH / 4;
  const stats4 = [
    { label: "TASKS", value: stats.taskCount, color: COLORS.ink },
    { label: "DONE", value: stats.totalDone, color: COLORS.moss },
    {
      label: "IN PROGRESS",
      value: stats.totalInProgress,
      color: COLORS.blueprint,
    },
    { label: "TODO", value: stats.totalTodo, color: COLORS.gray },
  ];
  stats4.forEach((s, i) => {
    const x = PAGE_MARGIN + i * statBoxWidth;
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor(s.color)
      .text(String(s.value), x, statY, { width: statBoxWidth, align: "left" });
    doc
      .fontSize(8)
      .font("Courier")
      .fillColor(COLORS.inkMuted)
      .text(s.label, x, statY + 24, { width: statBoxWidth, align: "left" });
  });

  doc.y = statY + 44;
  doc.moveDown(0.6);

  // Overall progress bar
  doc
    .fontSize(9)
    .font("Courier")
    .fillColor(COLORS.inkMuted)
    .text(
      `OVERALL — ${stats.totalDone}/${stats.taskCount ? stats.totalDone + stats.totalInProgress + stats.totalTodo : 0} subtasks done (${stats.overallPercent}%)`,
      PAGE_MARGIN,
      doc.y,
    );
  doc.moveDown(0.3);
  drawTwoSegmentBar(
    doc,
    CONTENT_WIDTH,
    10,
    stats.totalDone,
    stats.totalInProgress,
    stats.totalDone + stats.totalInProgress + stats.totalTodo,
  );

  doc.moveDown(1.2);
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .strokeColor(COLORS.blueprint)
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.8);
}

function drawTaskBlock(doc, task) {
  const blockPadding = 12;

  // Check page boundaries before printing task header
  if (doc.y > 660) {
    doc.addPage();
  }

  let segmentStart = doc.y;

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor(COLORS.ink)
    .text(task.raw_description, PAGE_MARGIN + blockPadding, segmentStart + 10, {
      width: CONTENT_WIDTH - blockPadding * 2,
    });

  doc.moveDown(0.2);
  doc
    .fontSize(8)
    .font("Courier")
    .fillColor(COLORS.inkMuted)
    .text(
      `STATUS: ${task.status.toUpperCase()}   ·   ${task.doneCount} DONE   ${task.inProgressCount} IN PROGRESS   ${task.todoCount} TODO`,
      PAGE_MARGIN + blockPadding,
      doc.y,
    );

  doc.moveDown(0.4);

  if (task.subtasks.length > 0) {
    drawTwoSegmentBar(
      doc,
      CONTENT_WIDTH - blockPadding * 2,
      6,
      task.doneCount,
      task.inProgressCount,
      task.subtaskCount,
      PAGE_MARGIN + blockPadding,
    );
    doc.moveDown(0.5);
  }

  if (task.subtasks.length === 0) {
    doc
      .fontSize(10)
      .font("Helvetica-Oblique")
      .fillColor(COLORS.inkMuted)
      .text(
        "Not yet decomposed — no subtasks.",
        PAGE_MARGIN + blockPadding,
        doc.y,
      );
    doc.moveDown(0.5);

    // Draw accent line for single-page block
    drawAccentLine(doc, segmentStart, doc.y);
  } else {
    for (const subtask of task.subtasks) {
      // If adding this subtask overflows to next page, cap current accent bar and start new segment
      if (doc.y > 710) {
        drawAccentLine(doc, segmentStart, doc.y);
        doc.addPage();
        segmentStart = doc.y;
      }
      drawSubtaskRow(doc, subtask, PAGE_MARGIN + blockPadding);
    }
    // Draw accent line for the last page segment
    drawAccentLine(doc, segmentStart, doc.y);
  }

  doc.moveDown(0.8);
}

function drawAccentLine(doc, topY, bottomY) {
  doc
    .moveTo(PAGE_MARGIN, topY)
    .lineTo(PAGE_MARGIN, bottomY)
    .strokeColor(COLORS.slate)
    .lineWidth(2)
    .stroke();
}

function drawSubtaskRow(doc, subtask, x) {
  const markerStyles = {
    done: { symbol: "[x]", color: COLORS.moss },
    in_progress: { symbol: "[~]", color: COLORS.blueprint },
    todo: { symbol: "[ ]", color: COLORS.gray },
  };
  const style = markerStyles[subtask.status] || markerStyles.todo;

  const rowY = doc.y;
  doc
    .fontSize(9)
    .font("Courier-Bold")
    .fillColor(style.color)
    .text(style.symbol, x, rowY, { width: 28 });

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(subtask.status === "done" ? COLORS.inkMuted : COLORS.ink)
    .text(subtask.description, x + 28, rowY, {
      width: CONTENT_WIDTH - (x - PAGE_MARGIN) - 28,
    });

  doc.moveDown(0.15);
}

function drawTwoSegmentBar(
  doc,
  width,
  height,
  doneCount,
  inProgressCount,
  total,
  xOverride,
) {
  const x = xOverride !== undefined ? xOverride : doc.x;
  const y = doc.y;

  doc.rect(x, y, width, height).fill(COLORS.slateLight);

  if (total > 0) {
    const doneWidth = (width * doneCount) / total;
    const inProgressWidth = (width * inProgressCount) / total;

    if (doneWidth > 0) {
      doc.rect(x, y, doneWidth, height).fill(COLORS.moss);
    }
    if (inProgressWidth > 0) {
      doc
        .rect(x + doneWidth, y, inProgressWidth, height)
        .fill(COLORS.blueprint);
    }
  }

  doc.y = y + height;
}

module.exports = { generateProjectReportPDF };
