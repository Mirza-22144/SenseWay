const express = require("express");
const cors = require("cors");

const env = require("./config/env");
const healthRoutes = require("./routes/health.routes");
const routeRoutes = require("./routes/routes.routes");
const refugeRoutes = require("./routes/refuge.routes");
const forecastRoutes = require("./routes/forecast.routes");
const notFound = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// Do not advertise the framework. One less hint for an attacker fingerprinting
// the stack.
app.disable("x-powered-by");

// Middleware
//
// CORS is restricted to an explicit allow-list from env (default: the local
// Vite dev server). A bare cors() would send Access-Control-Allow-Origin: *,
// which lets ANY website on the internet make requests to this API from a
// visitor's browser - not something we want for an API that can spend money on
// Google calls. Requests with no Origin header (curl, server-to-server, tests)
// are allowed through; the browser is the thing CORS protects.
const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
};
app.use(cors(corsOptions));

// 10kb body limit: a route request is tiny, so anything larger is a mistake or
// an attempt to exhaust memory. Oversized bodies are rejected as 413 by the
// error handler (err.type === "entity.too.large").
app.use(express.json({ limit: "10kb" }));

// Default route (unchanged - the original welcome message must still work).
app.get("/", (req, res) => {
  res.send("Welcome to SenseWay Backend");
});

// API routes. All feature endpoints live under /api.
app.use("/api", healthRoutes);
app.use("/api", routeRoutes);
app.use("/api", refugeRoutes);
app.use("/api", forecastRoutes);

// Unmatched routes -> JSON 404 (see notFound for why not app.get("*")).
app.use(notFound);

// Central error handler - must be last, and must have four arguments.
app.use(errorHandler);

module.exports = app;
