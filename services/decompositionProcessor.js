const llmService = require("./llmService");
const { parseAndValidateSubtasks } = require("./decompositionValidator");
const teamService = require("./teamService");
const sseService = require("./sseService");
const pool = require("../db");

const MIN_INPUT_LENGTH = 5;
const MAX_INPUT_LENGTH = 2000;

async function processDecompositionJob(taskId) {
  const taskResult = await pool.query(
    `SELECT t.raw_description, p.team_id
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1`,
    [taskId],
  );

  if (taskResult.rows.length === 0) {
    throw new Error(`Task ${taskId} not found`);
  }

  const { raw_description: rawDescription, team_id: teamId } =
    taskResult.rows[0];

  if (!rawDescription || rawDescription.trim().length < MIN_INPUT_LENGTH) {
    throw new Error("Task description is too short to decompose");
  }
  if (rawDescription.length > MAX_INPUT_LENGTH) {
    throw new Error("Task description is too long to decompose");
  }

  const customApiKey = await teamService.getDecryptedGeminiKey(teamId);
  const llmResponse = await llmService.decomposeTask(
    rawDescription,
    customApiKey,
  );
  const subtasks = parseAndValidateSubtasks(llmResponse.rawText);

  // Persist subtasks into the real subtasks table
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    //Delete existing subtasks (in case of re-decomposing)
    await client.query(`DELETE FROM subtasks WHERE task_id = $1`, [taskId]);
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
    sseService.broadcast(teamId, "subtasks:changed");
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
