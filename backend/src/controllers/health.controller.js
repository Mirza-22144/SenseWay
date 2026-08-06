"use strict";

/**
 * Liveness check. Deliberately touches NOTHING external - no database, no
 * Google, no pipeline. A health check that fails because someone else's service
 * is down is worse than no health check, because it triggers false alarms and
 * masks whether this process itself is healthy.
 */
function getHealth(req, res) {
  res.json({
    status: "ok",
    service: "senseway-backend",
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };
