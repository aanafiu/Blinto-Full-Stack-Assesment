// Node's built-in crypto module, used only to generate random unique ids.
const crypto = require('crypto');
// Our custom error class (status + code + message), for 400/404/409 errors.
const { ApiError } = require('../errors');
// validateCinema checks the cinema fields; parseGroupSize checks the ?groupSize= value.
const { validateCinema, parseGroupSize } = require('../validation');
// The hand-written dynamic programming that finds the fewest bundles.
const { minBundles } = require('../lib/bundles');

// Helper: make a name comparable (trim outer spaces + lowercase),
// so "Star Cineplex" and " star cineplex " count as the same name.
const norm = (s) => s.trim().toLowerCase();

// Creates ONE cinema inside the draft. (No saving here: that happens in createCinemas.)
function createOne(draft, body) {
  // 1. Check the input: name, and 1 to 10 different bundle sizes of 1 to 500.
  // Throws 400 if invalid; returns cleaned values (trimmed name, sorted sizes).
  const input = validateCinema(body);
  // 2. The name must be unique. `.some(...)` is true if ANY existing cinema has the same normalised name.
  if (draft.cinemas.some((c) => norm(c.name) === norm(input.name))) {
    // Duplicate: reject with 409 (conflict with existing data).
    throw new ApiError(409, 'DUPLICATE_NAME', `A cinema named "${input.name}" already exists`);
  }
  // Build the cinema object to store: a random id plus the cleaned name and sizes.
  const cinema = { id: crypto.randomUUID(), name: input.name, bundleSizes: input.bundleSizes };
  // Add it to the DRAFT list (not the real data).
  draft.cinemas.push(cinema);
  // Return it, so the caller can send it back in the response.
  return cinema;
}

// Creates one cinema (body is an object) or many (body is an array).
function createCinemas(store, body) {
  // Take a safe copy of the data to work on.
  const draft = store.snapshot();
  // Will hold the created cinema (or cinemas).
  let result;
  if (Array.isArray(body)) {
    // An empty array is pointless: reject it.
    if (body.length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Provide at least one cinema');
    // Create each item in the SAME draft, one after another.
    // This also means two cinemas in the same array can't share a name,
    // because the second one sees the first one in the draft.
    result = body.map((item, index) => {
      try {
        return createOne(draft, item);
      } catch (err) {
        // If it's one of our errors, add the position to the message ("cinemas[1]: ...")
        // so the client knows which item was bad.
        if (err instanceof ApiError) err.message = `cinemas[${index}]: ${err.message}`;
        // Re-throw, so everything stops and nothing is committed.
        throw err;
      }
    });
  } else {
    // A single cinema.
    result = createOne(draft, body);
  }
  // Reached only if EVERYTHING passed: replace the real data with the draft and save to disk.
  store.commit(draft);
  return result;
}

// Finds one cinema by id, or throws 404.
// Note: it takes the `store` (not a draft), because it only reads the real data.
function findCinema(store, id) {
  // Search the real list for the first cinema whose id matches.
  const cinema = store.data.cinemas.find((c) => c.id === id);
  // Nothing found (undefined): 404.
  if (!cinema) throw new ApiError(404, 'NOT_FOUND', 'Cinema not found');
  return cinema;
}

// Builds the answer for GET /cinemas/:id/booking?groupSize=44.
// `rawGroupSize` is the untouched text from the URL.
function getBookingQuote(store, id, rawGroupSize) {
  // Find the cinema first. If the id is unknown, this throws 404 right here.
  const cinema = findCinema(store, id);
  // Validate the group size and convert the text "44" into the number 44. Throws 400 if invalid.
  const groupSize = parseGroupSize(rawGroupSize);
  // Run the dynamic programming. It returns { totalBundles, breakdown },
  // or null when no exact combination exists.
  const quote = minBundles(cinema.bundleSizes, groupSize);
  // Fields that go in the answer in BOTH cases (possible or not), so we build them once.
  const base = { cinemaId: cinema.id, cinemaName: cinema.name, groupSize, bundleSizes: cinema.bundleSizes };
  // `quote` is null: no exact combination. This is a valid answer, not an error,
  // so we return it normally (HTTP 200) with possible: false.
  if (!quote) {
    // `...base` copies all the base fields into the new object, then we add two more.
    return { ...base, possible: false, message: `No combination of bundles adds up to exactly ${groupSize} seats` };
  }
  // A combination exists: copy the base fields, add possible: true, and spread the quote
  // (which adds totalBundles and breakdown).
  return { ...base, possible: true, ...quote };
}

// Make these functions available to routes/index.js.
module.exports = { createCinemas, findCinema, getBookingQuote };