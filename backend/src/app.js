const express = require("express");
const cors = require("cors");
const buildRouter = require("./routes");
const { ApiError } = require("./errors");

// This lets tests create an app with a fresh in-memory store.
function createApp(store) {
  const app = express();

  // Allow requests from other origins similar to the React dev server on :5173
  app.use(cors());

  // Parse JSON request bodies into req.body.
  // Malformed JSON makes this middleware throw "entity.parse.failed" (handled below).
  app.use(express.json());

  // Mount all API routes under /api
  app.use("/api", buildRouter(store));

  // Catch-all: runs only if no route above matched, so it creates a 404.
  // It must come AFTER the routes, because Express checks middleware in order.
  app.use((_req, _res, next) =>
    next(new ApiError(404, "NOT_FOUND", "Route not found")),
  );
  // how a next() function works
  // request -> cors -> express.json -> /api router (no match, so it calls next() internally)
  // -> 404 middleware runs: next(new ApiError(404, ...))
  // -> because an argument was passed, Express skips to the error handler
  // -> error handler sees ApiError -> sends {"error":{"code":"NOT_FOUND",...}}

  // Central error handler. Express recognises it as an error handler because
  // it has FOUR parameters (err, req, res, next), even though `next` is unused.
  // Every error thrown or passed to next() in the app ends up here, so all
  // errors share one response shape: { error: { code, message, details } }.
  app.use((err, _req, res, _next) => {
    // Expected errors we throw on purpose (validation, 404, 409...):
    // send the status code and message we chose.
    if (err instanceof ApiError) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }

    // express.json() reports bad JSON with this type: a client mistake, so 400.
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({
        error: {
          code: "INVALID_JSON",
          message: "Request body is not valid JSON",
        },
      });
    }

    // Anything else is an unexpected bug. Log the details on the server,
    // but send a generic message so internal details are never leaked to clients.
    console.error(err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  });

  return app;
}

module.exports = { createApp };