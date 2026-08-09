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

// hide the framework from response headers
app.disable("x-powered-by");

// CORS: only origins in env.corsOrigins are allowed (requests with no Origin
// header - curl, server-to-server, tests - are always allowed through)
const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
};
app.use(cors(corsOptions));

// reject oversized request bodies (413 via errorHandler)
app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.send("Welcome to SenseWay Backend");
});

// feature routes, all under /api
app.use("/api", healthRoutes);
app.use("/api", routeRoutes);
app.use("/api", refugeRoutes);
app.use("/api", forecastRoutes);

app.use(notFound); // unmatched routes -> JSON 404
app.use(errorHandler); // must be last, must have 4 args

module.exports = app;
