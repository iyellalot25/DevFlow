const PDFDocument = require("pdfkit");

function generateProjectReportPDF(reportData, stream) {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(stream);

  const {
    project,
    tasks,
    totalSubtasks,
    totalDone,
    overallPercent,
    generatedAt,
  } = reportData;

  // Header
  doc.fontSize(20).text("DevFlow — Project Progress Report", { align: "left" });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .fillColor("#666")
    .text(`Generated: ${generatedAt.toLocaleString()}`);
  doc.fillColor("#000");
  doc.moveDown(1);

  // Project summary
  doc.fontSize(18).text(project.name);
  if (project.description) {
    doc.fontSize(11).fillColor("#444").text(project.description);
    doc.fillColor("#000");
  }
  doc.moveDown(0.5);
  doc
    .fontSize(16)
    .text(
      `Overall progress: ${totalDone} / ${totalSubtasks} subtasks complete (${overallPercent}%)`,
    );
  drawProgressBar(doc, overallPercent);
  doc.moveDown(1.2);

  // Divider
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ccc").stroke();
  doc.moveDown(1);

  if (tasks.length === 0) {
    doc.fontSize(12).fillColor("#666").text("No tasks yet in this project.");
  }

  // Tasks
  for (const task of tasks) {
    if (doc.y > 680) doc.addPage();

    doc
      .fontSize(18)
      .fillColor("#000")
      .text(task.raw_description, { continued: false });
    doc
      .fontSize(9)
      .fillColor("#666")
      .text(
        `Status: ${task.status}  ·  ${task.doneCount}/${task.subtaskCount} subtasks done (${task.percentComplete}%)`,
      );
    doc.fillColor("#000");
    doc.moveDown(0.3);

    if (task.subtasks.length === 0) {
      doc
        .fontSize(16)
        .fillColor("#999")
        .text("  (no subtasks — not yet decomposed)");
      doc.fillColor("#000");
    } else {
      for (const subtask of task.subtasks) {
        if (doc.y > 700) doc.addPage();
        const marker = subtask.status === "done" ? "[x]" : "[ ]";
        doc
          .fontSize(12)
          .text(`  ${marker} ${subtask.description}`, { indent: 10 });
      }
    }
    doc.moveDown(0.8);
  }

  doc.end();
}

function drawProgressBar(doc, percent) {
  const barWidth = 300;
  const barHeight = 10;
  const x = doc.x;
  const y = doc.y + 4;

  doc.rect(x, y, barWidth, barHeight).strokeColor("#ccc").stroke();
  doc
    .rect(x, y, (barWidth * percent) / 100, barHeight)
    .fillColor("#2563eb")
    .fill();
  doc.fillColor("#000");
  doc.moveDown(1);
}

module.exports = { generateProjectReportPDF };
