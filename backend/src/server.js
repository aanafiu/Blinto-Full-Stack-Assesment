// Node's built-in "path" module, used to build file paths that work on Windows, Mac and Linux.
const path = require("path");
// Our data layer (memory + JSON file). `{ Store }` picks the class out of store.js's exports.
const { Store } = require("./store");
// The function that builds the Express app (middleware, routes, error handler).
const { createApp } = require("./app");
// The function that loads the sample MCU movies and cinemas.
const { seed } = require("./seed");

// Which port to listen on. `process.env.PORT` reads an environment variable.
// `||` means: if it isn't set, use 4000. (Docker and hosting services often set PORT for you.)
const PORT = process.env.PORT || 4000;
// Where the data file lives. Use the DATA_FILE environment variable if it is set
// (Docker sets it to /data/db.json); otherwise build the default path.
// The line is split in two only because the code formatter wrapped it.
const file =
  // __dirname is the folder of this file (backend/src). ".." goes up one level to backend/,
  // so the default is backend/data/db.json.
  process.env.DATA_FILE || path.join(__dirname, "..", "data", "db.json");

// Create the store. If the file already exists, its data is loaded into memory now.
const store = new Store(file);
// Seed sample data only when BOTH are true:
//  - SEED_ON_START is the text "true" (environment variables are always text, never booleans)
//  - the database is empty, so we never overwrite or duplicate your real data
if (process.env.SEED_ON_START === "true" && store.isEmpty()) {
  // Create the sample movies and cinemas and save them to the file.
  seed(store);
  // Print a message in the terminal so you know it happened.
  console.log("Seeded sample data");
}

// Build the Express app with this store, then start accepting requests on PORT.
// The function after the comma runs ONCE, when the server has started listening.
createApp(store).listen(PORT, () =>
  // Print the address in the terminal. The backticks allow ${PORT} to be filled in.
  console.log(`Doomsday Ready API listening on http://localhost:${PORT}/api`),
);