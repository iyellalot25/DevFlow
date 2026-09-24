const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL_NAME = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `You are a task decomposition assistant for a software development tracking tool.
Given a developer's description of an engineering task, break it down into clear, actionable implementation subtasks.

Rules:
- Output ONLY a JSON array of strings. No markdown, no explanation, no code fences.
- Each string is one concrete, actionable subtask.
- Produce between 3 and 10 subtasks.
- Do NOT write any actual code, file contents, or code snippets.
- Do NOT include subtasks unrelated to the given task.

Example output format:
["Configure PostgreSQL connection", "Create the required database table", "Replace SQLite queries with PostgreSQL equivalents"]`;

// apiKeyOverride: a team's own key, if they've set one; falls back to the
// server-wide default key otherwise.
async function decomposeTask(rawDescription, apiKeyOverride) {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const response = await model.generateContent(rawDescription);
  const text = response.response.text();
  const usage = response.response.usageMetadata || {};

  return {
    rawText: text,
    promptTokens: usage.promptTokenCount ?? null,
    completionTokens: usage.candidatesTokenCount ?? null,
    modelName: MODEL_NAME,
  };
}

module.exports = { decomposeTask };
