"use strict";

// liveness check - touches nothing external (no DB, no Google, no pipeline)
function getHealth(req, res) {
  res.json({
    status: "ok",
    service: "senseway-backend",
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };
