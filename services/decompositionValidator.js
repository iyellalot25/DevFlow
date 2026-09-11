const MIN_SUBTASKS = 1;
const MAX_SUBTASKS = 15;
const MAX_SUBTASK_LENGTH = 300;

function parseAndValidateSubtasks(rawText) {
  let parsed;

  // Strip markdown code fences if the model added them despite instructions
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*|^```\s*|```$/g, "")
    .trim();

  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error("LLM response was not valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("LLM response was not a JSON array");
  }

  if (parsed.length < MIN_SUBTASKS || parsed.length > MAX_SUBTASKS) {
    throw new Error(
      `LLM returned ${parsed.length} subtasks, expected ${MIN_SUBTASKS}-${MAX_SUBTASKS}`,
    );
  }

  const subtasks = parsed.map((item, index) => {
    if (typeof item !== "string" || item.trim() === "") {
      throw new Error(
        `Subtask at index ${index} is not a valid non-empty string`,
      );
    }
    if (item.length > MAX_SUBTASK_LENGTH) {
      throw new Error(
        `Subtask at index ${index} exceeds ${MAX_SUBTASK_LENGTH} characters`,
      );
    }
    return { description: item.trim(), position: index + 1 };
  });

  return subtasks;
}

module.exports = { parseAndValidateSubtasks };
