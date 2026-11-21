// Node's built-in crypto module. We only use it to generate random unique ids.
const crypto = require('crypto');
// Our custom error class (status + code + message), for throwing 400/404/409 errors.
const { ApiError } = require('../errors');
// The input checker for movie fields (type, range, length).
const { validateMovie } = require('../validation');
// The two hand-written algorithms: cycle check and rewatch order.
const { wouldCreateCycle, rewatchOrder } = require('../lib/graph');

// Helper: make a title comparable. Removes outer spaces and lowercases it,
// so "  Iron Man " and "iron man" count as the same title.
const norm = (s) => s.trim().toLowerCase();

// Helper: builds (but does not throw) the 409 error for circular dependencies.
// It is a function so a fresh error object is created each time it is used
// (an error object records the place where it was created).
const circular = () =>
  new ApiError(409, 'CIRCULAR_DEPENDENCY', 'A movie cannot depend on itself, directly or through other movies');

// Helper: turn the movies array into a Map of id -> movie, for fast lookup by id.
// graph.js expects this shape. `[m.id, m]` is a [key, value] pair.
const byIdMap = (draft) => new Map(draft.movies.map((m) => [m.id, m]));

// Helper: find one movie by id in `draft.movies`, or undefined if there is none.
// The parameter is named `draft`, but any object with a `.movies` array works,
// which is why the route can pass `store.data` to it.
const findMovie = (draft, id) => draft.movies.find((m) => m.id === id);

// Throws 409 if another movie already has this title.
// `exceptId = null` is optional: when updating a movie, we pass its own id so it
// does not conflict with itself (renaming "Iron Man" to "Iron Man" is fine).
function assertUniqueTitle(draft, title, exceptId = null) {
  // `.some(...)` is true if ANY movie matches: a different movie (id differs)
  // with the same normalised title.
  if (draft.movies.some((m) => m.id !== exceptId && norm(m.title) === norm(title))) {
    throw new ApiError(409, 'DUPLICATE_TITLE', `A movie titled "${title}" already exists`);
  }
}

/** Prerequisites may be given as movie ids or (case-insensitive) titles. */
// Converts the list the client sent (ids or titles) into a clean list of ids.
// `refs` = the client's list. `{ selfId, selfTitle }` = who the movie itself is.
// On create there is no selfId yet (the movie has no id), so only the title is known.
function resolvePrerequisites(draft, refs, { selfId, selfTitle }) {
  // The final list of valid ids.
  const ids = [];
  // Entries that matched no movie, to report them all together.
  const unknown = [];
  // Go through each reference one by one.
  for (const ref of refs) {
    // If it points to the movie itself (by id, or by title), that is a direct cycle: reject now.
    // `selfId && ...` skips the id check when there is no selfId (create).
    if ((selfId && ref === selfId) || norm(ref) === norm(selfTitle)) throw circular();
    // Look for a movie whose id equals ref; if none, look for one whose title equals ref.
    // `||` means "use the second search only if the first found nothing".
    const match = draft.movies.find((m) => m.id === ref) || draft.movies.find((m) => norm(m.title) === norm(ref));
    // No movie found: remember this reference as unknown.
    if (!match) unknown.push(ref);
    // Found, and not already in the list: add its id. The `includes` check removes duplicates.
    else if (!ids.includes(match.id)) ids.push(match.id);
  }
  // After checking everything: if some references matched nothing, reject with 400
  // and list them in `details`.
  if (unknown.length) {
    throw new ApiError(400, 'UNKNOWN_PREREQUISITE', 'Some prerequisites do not match any movie', unknown);
  }
  // Return the clean list of ids.
  return ids;
}

// Creates ONE movie inside the draft. (No saving here: that happens in createMovies.)
function createOne(draft, body) {
  // 1. Check the input shape and ranges. Throws 400 if invalid; returns cleaned values.
  const input = validateMovie(body);
  // 2. Title must be unique.
  assertUniqueTitle(draft, input.title);
  // A brand-new movie has no dependants yet, so the only possible cycle is "depends on itself".
  // Turn the prerequisites (ids/titles) into ids. `?? []` means "use an empty list if none were sent".
  const prerequisites = resolvePrerequisites(draft, input.prerequisites ?? [], { selfTitle: input.title });
  // Build the movie object that will be stored.
  const movie = {
    // A random unique id, like "b06c0304-f660-486b-b120-0dc1697f8a54".
    id: crypto.randomUUID(),
    title: input.title,
    releaseYear: input.releaseYear,
    runtimeMinutes: input.runtimeMinutes,
    // The resolved ids, not the titles the client may have sent.
    prerequisites,
    // `??` uses the default `false` only when `watched` was not sent (undefined).
    // That is why it is `??` and not `||`: an explicit `false` must be kept as `false`.
    watched: input.watched ?? false,
  };
  // Add it to the DRAFT list (not the real data).
  draft.movies.push(movie);
  // Return it, so the caller can send it back in the response.
  return movie;
}

/** Create one movie (object) or several (array, all-or-nothing). */
// Creates one movie (body is an object) or many (body is an array).
function createMovies(store, body) {
  // Take a safe copy of the data to work on.
  const draft = store.snapshot();
  // Will hold the created movie (or movies).
  let result;
  if (Array.isArray(body)) {
    // An empty array is pointless: reject it.
    if (body.length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Provide at least one movie');
    // Create each item, one after another, in the SAME draft.
    // Because of that, a later movie in the array can name an earlier one as a prerequisite.
    result = body.map((item, index) => {
      try {
        return createOne(draft, item);
      } catch (err) {
        // If our own error happens, put the position in the message ("movies[2]: ...")
        // so the client knows which item was bad.
        if (err instanceof ApiError) err.message = `movies[${index}]: ${err.message}`;
        // Re-throw, so everything stops and nothing is committed.
        throw err;
      }
    });
  } else {
    // A single movie.
    result = createOne(draft, body);
  }
  // Reached only if EVERYTHING passed: replace the real data with the draft and save to disk.
  store.commit(draft);
  return result;
}

// Changes some fields of an existing movie (the PATCH route).
function updateMovie(store, id, body) {
  // Work on a copy.
  const draft = store.snapshot();
  // Find the movie inside the copy. None found: 404.
  const movie = findMovie(draft, id);
  if (!movie) throw new ApiError(404, 'NOT_FOUND', 'Movie not found');
  // Validate only the fields the client sent (`partial: true`).
  const input = validateMovie(body, { partial: true });

  // `!== undefined` means "the client sent this field". We compare with undefined
  // (and not "is truthy"), so values like `false` and `0` still count as sent.
  if (input.title !== undefined) {
    // New title must not clash with another movie (but may equal this movie's own title).
    assertUniqueTitle(draft, input.title, id);
    movie.title = input.title;
  }
  // Simple fields: copy them in when sent.
  if (input.releaseYear !== undefined) movie.releaseYear = input.releaseYear;
  if (input.runtimeMinutes !== undefined) movie.runtimeMinutes = input.runtimeMinutes;
  if (input.watched !== undefined) movie.watched = input.watched;
  // Prerequisites are the risky field, because they can create a cycle.
  if (input.prerequisites !== undefined) {
    // Turn ids/titles into ids. This catches direct self-reference and unknown movies.
    const ids = resolvePrerequisites(draft, input.prerequisites, { selfId: id, selfTitle: movie.title });
    // Catch indirect cycles (A -> B -> C -> A) with the graph algorithm.
    if (wouldCreateCycle(byIdMap(draft), id, ids)) throw circular();
    // Safe: apply the new list.
    movie.prerequisites = ids;
  }
  // Everything passed: save the draft as the real data.
  // (If anything above threw, this line was never reached, so no half-done change is saved.)
  store.commit(draft);
  return movie;
}

// Removes a movie.
function deleteMovie(store, id) {
  const draft = store.snapshot();
  // Not found: 404.
  if (!findMovie(draft, id)) throw new ApiError(404, 'NOT_FOUND', 'Movie not found');
  // Keep every movie EXCEPT the one with this id.
  draft.movies = draft.movies.filter((m) => m.id !== id);
  // Dependants must not keep a dangling prerequisite.
  // For every remaining movie, drop the deleted id from its prerequisites list.
  draft.movies.forEach((m) => (m.prerequisites = m.prerequisites.filter((p) => p !== id)));
  store.commit(draft);
}

// Builds the answer for GET /movies/:id/rewatch-order.
function getRewatchOrder(store, id) {
  // This only READS data, so no draft is needed: use the real data directly.
  const byId = byIdMap(store.data);
  // Find the target movie; none found: 404.
  const target = byId.get(id);
  if (!target) throw new ApiError(404, 'NOT_FOUND', 'Movie not found');
  // rewatchOrder returns a list of ids; `.map` turns each id into the full movie object.
  const order = rewatchOrder(byId, id).map((mid) => byId.get(mid));
  // Only the movies the user has NOT watched yet.
  const unwatched = order.filter((m) => !m.watched);
  return {
    // Just the id and title of the movie being planned for.
    target: { id: target.id, title: target.title },
    // The ordered list (prerequisites first).
    order,
    // How many movies must be watched in total.
    totalCount: order.length,
    // Watched = total minus unwatched.
    watchedCount: order.length - unwatched.length,
    // Add up the runtimes of the unwatched ones. `reduce` starts at 0 and adds each runtime.
    remainingMinutes: unwatched.reduce((sum, m) => sum + m.runtimeMinutes, 0),
  };
}

// Make these functions available to routes/index.js.
module.exports = { createMovies, updateMovie, deleteMovie, getRewatchOrder, findMovie };