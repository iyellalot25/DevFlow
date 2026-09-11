const jobService = require("./services/jobService");
const {
  processDecompositionJob,
} = require("./services/decompositionProcessor");

const POLL_INTERVAL_MS = 2000;

async function pollOnce() {
  try {
    const job = await jobService.claimNextPendingJob();
    if (!job) return; // nothing to do this tick

    console.log(`[worker] processing job ${job.id} (task ${job.task_id})`);

    try {
      const result = await processDecompositionJob(job.task_id);
      await jobService.completeJob(job.id, result, result.usage);
      console.log(`[worker] job ${job.id} done`);
    } catch (err) {
      console.error(`[worker] job ${job.id} failed:`, err.message);
      await jobService.failJob(job.id, err.message);
    }
  } catch (err) {
    console.error("[worker] poll error:", err);
  }
}

async function startWorker() {
  const recoveredIds = await jobService.recoverStuckJobs();
  if (recoveredIds.length > 0) {
    console.log(
      `[worker] recovered ${recoveredIds.length} stuck job(s) from a previous crash: ${recoveredIds.join(", ")}`,
    );
  }

  console.log(`[worker] started, polling every ${POLL_INTERVAL_MS}ms`);
  setInterval(pollOnce, POLL_INTERVAL_MS);
}

module.exports = startWorker;
