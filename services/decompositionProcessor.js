const llmService = require("./llmService");
const { parseAndValidateSubtasks } = require("./decompositionValidator");
const pool = require("../db");

const MIN_INPUT_LENGTH = 5;
const MAX_INPUT_LENGTH = 2000;

async function processDecompositionJob(taskId) {
  const taskResult = await pool.query(
    `SELECT raw_description FROM tasks WHERE id = $1`,
    [taskId],
  );

  if (taskResult.rows.length === 0) {
    throw new Error(`Task ${taskId} not found`);
  }

  const rawDescription = taskResult.rows[0].raw_description;

  if (!rawDescription || rawDescription.trim().length < MIN_INPUT_LENGTH) {
    throw new Error("Task description is too short to decompose");
  }
  if (rawDescription.length > MAX_INPUT_LENGTH) {
    throw new Error("Task description is too long to decompose");
  }

  const llmResponse = await llmService.decomposeTask(rawDescription);
  const subtasks = parseAndValidateSubtasks(llmResponse.rawText);

  // Persist subtasks into the real subtasks table
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const subtask of subtasks) {
      await client.query(
        `INSERT INTO subtasks (task_id, description, position)
         VALUES ($1, $2, $3)`,
        [taskId, subtask.description, subtask.position],
      );
    }
    await client.query(`UPDATE tasks SET status = 'decomposed' WHERE id = $1`, [
      taskId,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return {
    subtasks,
    usage: {
      promptTokens: llmResponse.promptTokens,
      completionTokens: llmResponse.completionTokens,
      modelName: llmResponse.modelName,
    },
  };
}

module.exports = { processDecompositionJob };
