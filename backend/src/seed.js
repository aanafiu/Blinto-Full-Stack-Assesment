// Node's built-in "path" module, for building file paths that work on every operating system.
const path = require('path');
// The data layer (memory + JSON file). Needed here because running this file directly creates its own store.
const { Store } = require('./store');
// The service function that creates movies (one object or an array), with all the validation rules.
const { createMovies } = require('./services/movieService');
// The same for cinemas.
const { createCinemas } = require('./services/cinemaService');
// The sample data itself: `data.movies` and `data.cinemas` (kept in seedData.js).
const data = require('./seedData');

// Loads the sample data into a store that is passed in.
// Taking the store as a parameter is why tests, server.js and the command line can all reuse it.
function seed(store) {
  // Create all 8 movies in ONE call. The array is all-or-nothing, and later movies can name earlier
  // ones as prerequisites BY TITLE (e.g. "Iron Man"), because they all share the same draft.
  createMovies(store, data.movies);
  // Create the 4 sample cinemas the same way.
  createCinemas(store, data.cinemas);
}

// Make `seed` available to other files (server.js and api.test.js import it).
// This line comes BEFORE the `if` below on purpose: it runs in every case.
module.exports = { seed };

// `require.main === module` is true only when THIS file is the one you started with Node
// (`node src/seed.js`, which is what `npm run seed` does).
// When another file imports seed.js, it is false, so the block below does not run.
// Without this check, importing the file would seed the database as a side effect.
if (require.main === module) {
  // Use the DATA_FILE environment variable if it is set; otherwise backend/data/db.json.
  // (Same rule as server.js, so both commands use the same file.)
  const file = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
  // Open the store. If the file already exists, its data is loaded into memory now.
  const store = new Store(file);
  // Safety check: never add sample data on top of data that is already there.
  if (!store.isEmpty()) {
    // Tell the user why nothing happened. (This is the message you saw earlier.)
    console.log('Database already has data, skipping seed.');
  } else {
    // Empty database: create the sample data. The services save it to the file as they go.
    seed(store);
    // Print how many items were created, and where.
    console.log(`Seeded ${store.data.movies.length} movies and ${store.data.cinemas.length} cinemas into ${file}`);
  }
}