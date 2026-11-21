// Load our custom error class
const { ApiError } = require('./errors');

// Small helper: is `v` a plain object like { a: 1 }?
// Three checks: not null (typeof null is also 'object' in JavaScript),
// is an object, and is NOT an array (arrays are objects too, but we don't want them here).
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Small helper: stop everything and report a validation failure.
// `what` is the word used in the message ("movie" or "cinema"); `errors` is the list of problems.
// It always throws, so the code after a call to fail() never runs.
const fail = (what, errors) => {
  throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ${what} data`, errors);
};

/** Validates movie fields. With `partial`, only fields that are present are checked. */
// `body` is the JSON the client sent. `{ partial = false } = {}` is an optional second argument:
// if nobody passes it, partial is false (full check, used for creating a movie).
// PATCH passes partial: true, because an update may send only one field.
function validateMovie(body, { partial = false } = {}) {
  // If the body isn't an object (for example a number, null, or an array), fail immediately.
  if (!isObject(body)) fail('movie', ['body must be a JSON object']);
  // `errors` collects every problem found, so the user sees all of them at once.
  const errors = [];
  // `out` will hold only the cleaned, valid values. It is what we return.
  const out = {};

  // Check the title when: this is a full check (create), OR the client sent a title (update).
  // `'title' in body` asks "does the object have a property called title?".
  if (!partial || 'title' in body) {
    // Not a string, or empty/only spaces after trimming: record an error.
    if (typeof body.title !== 'string' || !body.title.trim()) errors.push('title is required (non-empty string)');
    // Too long: record an error.
    else if (body.title.trim().length > 200) errors.push('title must be at most 200 characters');
    // Valid: save the trimmed version (spaces at the start and end removed).
    else out.title = body.title.trim();
  }
  // Same idea for the release year.
  if (!partial || 'releaseYear' in body) {
    // Number.isInteger is false for strings like "2008", decimals like 2008.5, and missing values.
    // So the year must be a real whole number between 1888 (first film ever) and 2100.
    if (!Number.isInteger(body.releaseYear) || body.releaseYear < 1888 || body.releaseYear > 2100)
      errors.push('releaseYear must be an integer between 1888 and 2100');
    else out.releaseYear = body.releaseYear;
  }
  // Same idea for the runtime, using the brief's range of 1 to 300 minutes.
  if (!partial || 'runtimeMinutes' in body) {
    if (!Number.isInteger(body.runtimeMinutes) || body.runtimeMinutes < 1 || body.runtimeMinutes > 300)
      errors.push('runtimeMinutes must be an integer between 1 and 300');
    else out.runtimeMinutes = body.runtimeMinutes;
  }
  // Prerequisites are optional, so we check them only if the client sent them (no `!partial ||`).
  if ('prerequisites' in body) {
    // Must be an array, and `.some(...)` finds any item that is not a non-empty string.
    // One bad item makes the whole list invalid.
    if (!Array.isArray(body.prerequisites) || body.prerequisites.some((p) => typeof p !== 'string' || !p.trim()))
      errors.push('prerequisites must be an array of movie ids or titles');
    // Valid: keep the list, with spaces trimmed from each item.
    else out.prerequisites = body.prerequisites.map((p) => p.trim());
  }
  // `watched` is also optional. It must be exactly true or false (not "true" or 1).
  if ('watched' in body) {
    if (typeof body.watched !== 'boolean') errors.push('watched must be true or false');
    else out.watched = body.watched;
  }
  // If any problem was collected, throw one 400 error containing the whole list.
  if (errors.length) fail('movie', errors);
  // Otherwise return only the valid, cleaned fields.
  return out;
}

// Validates a cinema. There is no `partial` option, because cinemas can't be updated.
function validateCinema(body) {
  // Same object check as above.
  if (!isObject(body)) fail('cinema', ['body must be a JSON object']);
  const errors = [];
  const out = {};

  // Name must be a non-empty string, at most 100 characters.
  if (typeof body.name !== 'string' || !body.name.trim()) errors.push('name is required (non-empty string)');
  else if (body.name.trim().length > 100) errors.push('name must be at most 100 characters');
  else out.name = body.name.trim();

  // Put the sizes in a short variable name, to keep the lines readable.
  const sizes = body.bundleSizes;
  // Rule 1: it must be an array holding 1 to 10 items.
  if (!Array.isArray(sizes) || sizes.length < 1 || sizes.length > 10) {
    errors.push('bundleSizes must be an array of 1 to 10 sizes');
  // Rule 2: every size must be a whole number from 1 to 500.
  } else if (sizes.some((s) => !Number.isInteger(s) || s < 1 || s > 500)) {
    errors.push('every bundle size must be an integer between 1 and 500');
  // Rule 3: no duplicates. A Set keeps only unique values, so if its size is smaller
  // than the array's length, some value appeared twice.
  } else if (new Set(sizes).size !== sizes.length) {
    errors.push('bundle sizes must be different from each other (no duplicates)');
  // All rules passed: save a sorted copy, smallest first.
  // `[...sizes]` copies the array so the original isn't changed. `(a, b) => a - b` is needed
  // because JavaScript's default sort compares as text (so 10 would come before 2).
  } else {
    out.bundleSizes = [...sizes].sort((a, b) => a - b);
  }
  // Because of the else-if chain, only the FIRST bundle-size problem is reported.
  if (errors.length) fail('cinema', errors);
  return out;
}

// Checks the `groupSize` value from the URL (?groupSize=44) and turns it into a number.
// `raw` is whatever came from req.query.groupSize.
function parseGroupSize(raw) {
  // Reject if ANY of these is true:
  //  - it isn't a string (missing gives undefined; ?groupSize=1&groupSize=2 gives an array)
  //  - it doesn't consist only of digits (the regex /^\d+$/ rejects "abc", "6.5", "-3", " 6")
  //  - the number is below 1 or above 10000
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 10000) {
    // Throw directly here (not through `fail`), because this error has no `details` list.
    throw new ApiError(400, 'VALIDATION_ERROR', 'groupSize must be an integer between 1 and 10000');
  }
  // URL values are always text, so convert "44" into the number 44.
  return Number(raw);
}

// Make the three functions available to the service files.
module.exports = { validateMovie, validateCinema, parseGroupSize };