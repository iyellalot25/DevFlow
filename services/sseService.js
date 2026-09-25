// In-memory registry of open SSE connections, keyed by team_id.
// Single-instance only : would need
// Redis pub/sub to scale beyond one server instance.
const teamConnections = new Map(); // teamId -> Set<res>

function addConnection(teamId, res) {
  if (!teamConnections.has(teamId)) {
    teamConnections.set(teamId, new Set());
  }
  teamConnections.get(teamId).add(res);
}

function removeConnection(teamId, res) {
  const conns = teamConnections.get(teamId);
  if (!conns) return;
  conns.delete(res);
  if (conns.size === 0) {
    teamConnections.delete(teamId);
  }
}

function broadcast(teamId, eventType, payload = {}) {
  const conns = teamConnections.get(teamId);
  if (!conns || conns.size === 0) return;

  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of conns) {
    res.write(message);
  }
}

module.exports = { addConnection, removeConnection, broadcast };
