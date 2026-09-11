// Phase 4: STUB processor. Proves the async job mechanism works.

function processDecompositionJob(taskId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        subtasks: [
          { description: "[STUB] Analyze requirements", position: 1 },
          { description: "[STUB] Implement core logic", position: 2 },
          { description: "[STUB] Write tests", position: 3 },
        ],
      });
    }, 3000); // simulate slow work
  });
}

module.exports = { processDecompositionJob };
