// Node's built-in test runner: `test(name, function)` defines one test.
const test = require('node:test');
// Strict assertions: `equal` uses ===, `deepEqual` compares whole objects/arrays.
const assert = require('node:assert/strict');
// The data layer. `new Store()` with no file path means in-memory only, so tests never touch db.json.
const { Store } = require('../src/store');
// The function that builds the Express app (same one server.js uses).
const { createApp } = require('../src/app');
// The function that loads the sample MCU movies and cinemas.
const { seed } = require('../src/seed');

// Test helper: starts a fresh app and returns tools for talking to it.
// It is `async` because it makes HTTP requests and must wait for the answers.
async function start() {
  // A brand-new empty in-memory store, so every test begins from a clean state.
  const store = new Store();
  // Fill it with the sample data (8 movies and 4 cinemas).
  seed(store);
  // Start the app on port 0. Port 0 means "pick any free port", so tests never clash with
  // your running server on 4000, and can run at the same time as each other.
  const server = createApp(store).listen(0);
  // Build the base URL using the port the system chose.
  const base = `http://localhost:${server.address().port}/api`;
  // Helper to send a request: method ('GET', 'POST'...), a path, and an optional body.
  const call = async (method, path, body) => {
    // `fetch` is built into Node 18+. It sends a real HTTP request, like a browser or Postman would.
    const res = await fetch(base + path, {
      method,
      // Tell the server we are sending JSON.
      headers: { 'Content-Type': 'application/json' },
      // If there is a body, turn the object into JSON text. With no body (GET), send nothing.
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // Read the response as text first. A 204 response (delete) has no body, and calling
    // res.json() on an empty body would throw an error.
    const text = await res.text();
    // Return the status code and the parsed body (or null if there was no body).
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  // Fetch all movies now, so tests can look up ids by title (ids are random on every run).
  const movies = (await call('GET', '/movies')).body;
  // Helper: give a movie title, get back its id. `.find` returns the first matching movie.
  const idOf = (title) => movies.find((m) => m.title === title).id;
  // Return the tools. `close` stops the server, so the test process can finish.
  return { call, idOf, close: () => server.close() };
}

// ---------- Test 1: the rewatch-order examples from the assessment ----------
test('rewatch order: spec examples', async () => {
  // Start a fresh app. The `{ call, idOf, close }` picks the three tools out of the returned object.
  const { call, idOf, close } = await start();
  // try/finally: `close()` in finally runs even when an assertion fails, so the server is
  // always stopped. Otherwise a failed test could leave the process hanging.
  try {
    // Ask for the rewatch order of Avengers: Doomsday.
    let r = await call('GET', `/movies/${idOf('Avengers: Doomsday')}/rewatch-order`);
    // The request must succeed.
    assert.equal(r.status, 200);
    // The brief says: all 7 other movies.
    assert.equal(r.body.order.length, 7);
    // Endgame depends on everything else in the chain, so it must be last. (`.at(-1)` = last item.)
    assert.equal(r.body.order.at(-1).title, 'Avengers: Endgame');
    // Nothing is watched yet.
    assert.equal(r.body.watchedCount, 0);
    // Total runtime of all 7 unwatched movies: 126+124+143+147+130+149+181 = 1000 minutes.
    assert.equal(r.body.remainingMinutes, 126 + 124 + 143 + 147 + 130 + 149 + 181);

    // Second example: Civil War needs Iron Man, The First Avenger and The Avengers.
    r = await call('GET', `/movies/${idOf('Captain America: Civil War')}/rewatch-order`);
    // The last one must be The Avengers (the other two may come in either order, as the brief allows).
    assert.deepEqual(r.body.order.map((m) => m.title).slice(-1), ['The Avengers']);
    // And there are exactly 3 movies in total.
    assert.equal(r.body.order.length, 3);

    // Third example: Thor: Ragnarok has no prerequisites, so the list must be empty.
    r = await call('GET', `/movies/${idOf('Thor: Ragnarok')}/rewatch-order`);
    assert.deepEqual(r.body.order, []);
  } finally { close(); }
});

// ---------- Test 2: watched movies reduce the remaining time ----------
test('watched ticks reduce remaining time', async () => {
  const { call, idOf, close } = await start();
  try {
    // Mark Iron Man as watched (a real PATCH request, as the UI sends it).
    await call('PATCH', `/movies/${idOf('Iron Man')}`, { watched: true });
    // Ask for the Doomsday plan again.
    const r = await call('GET', `/movies/${idOf('Avengers: Doomsday')}/rewatch-order`);
    // One of the 7 is now watched.
    assert.equal(r.body.watchedCount, 1);
    // Remaining time is 1000 - 126 (Iron Man's runtime). The sum here leaves Iron Man out.
    assert.equal(r.body.remainingMinutes, 124 + 143 + 147 + 130 + 149 + 181);
  } finally { close(); }
});

// ---------- Test 3: circular dependency is rejected and nothing changes ----------
test('circular dependency -> 409, state unchanged', async () => {
  const { call, idOf, close } = await start();
  try {
    // The brief's example: make Endgame a prerequisite of Iron Man. That would be a loop.
    let r = await call('PATCH', `/movies/${idOf('Iron Man')}`, { prerequisites: [idOf('Avengers: Endgame')] });
    // Expect 409 with the exact error code the brief asks for.
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'CIRCULAR_DEPENDENCY');
    // Direct self-dependency: Iron Man needing itself. Also 409.
    r = await call('PATCH', `/movies/${idOf('Iron Man')}`, { prerequisites: [idOf('Iron Man')] });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'CIRCULAR_DEPENDENCY');
    // Fetch Iron Man again: after two rejected requests, its prerequisites must still be empty.
    // This proves the draft/commit pattern works (a failed request changes nothing).
    const iron = (await call('GET', `/movies/${idOf('Iron Man')}`)).body;
    assert.deepEqual(iron.prerequisites, []);
  } finally { close(); }
});

// ---------- Test 4: movie validation, uniqueness and not-found ----------
test('movie validation and uniqueness', async () => {
  // This test only creates and rejects movies, so `idOf` is not needed.
  const { call, close } = await start();
  try {
    // Runtime above 300: 400.
    assert.equal((await call('POST', '/movies', { title: 'X', releaseYear: 2020, runtimeMinutes: 301 })).status, 400);
    // Runtime below 1: 400.
    assert.equal((await call('POST', '/movies', { title: 'X', releaseYear: 2020, runtimeMinutes: 0 })).status, 400);
    // Same title as an existing one, with different case and extra spaces: 409 duplicate.
    assert.equal((await call('POST', '/movies', { title: ' iron man ', releaseYear: 2020, runtimeMinutes: 90 })).status, 409);
    // A valid new movie: 201 Created.
    const ok = await call('POST', '/movies', { title: 'Brand New', releaseYear: 2020, runtimeMinutes: 90 });
    assert.equal(ok.status, 201);
    // `watched` was not sent, so it must default to false.
    assert.equal(ok.body.watched, false);
    // A new movie that lists itself as a prerequisite: 409 circular.
    assert.equal((await call('POST', '/movies', { title: 'Self', releaseYear: 2020, runtimeMinutes: 90, prerequisites: ['Self'] })).status, 409);
    // Updating a movie id that doesn't exist: 404.
    assert.equal((await call('PATCH', '/movies/nope', { watched: true })).status, 404);
  } finally { close(); }
});

// ---------- Test 5: deleting a movie cleans up references to it ----------
test('delete removes dangling prerequisites', async () => {
  const { call, idOf, close } = await start();
  try {
    // Remember Iron Man's id BEFORE deleting it (afterwards `idOf` could not find it).
    const iron = idOf('Iron Man');
    // Delete it: 204 No Content (success with no body).
    assert.equal((await call('DELETE', `/movies/${iron}`)).status, 204);
    // The Avengers used to need Iron Man. Its prerequisites must no longer contain that id.
    const avengers = (await call('GET', `/movies/${idOf('The Avengers')}`)).body;
    assert.ok(!avengers.prerequisites.includes(iron));
  } finally { close(); }
});

// ---------- Test 6: cinema booking examples and validation ----------
test('cinema booking: spec examples and validation', async () => {
  const { call, close } = await start();
  try {
    // Helper: create a cinema and return it. The name gets a "T-" prefix so it can't clash
    // with the four seeded cinemas. `.body` is the created cinema (with its random id).
    const mk = async (name, bundleSizes) => (await call('POST', '/cinemas', { name: `T-${name}`, bundleSizes })).body;
    // Cinema "T-a" sells bundles of 1, 3 and 4.
    const a = await mk('a', [1, 3, 4]);
    // Quote for a group of 6 (the cinema's id goes in the URL; groupSize goes in the query string).
    const quote = (await call('GET', `/cinemas/${a.id}/booking?groupSize=6`)).body;
    // It must be possible, using the minimum of 2 bundles.
    assert.equal(quote.possible, true);
    assert.equal(quote.totalBundles, 2);

    // Cinema "T-d" sells 4 and 6. A group of 7 is impossible.
    const d = await mk('d', [4, 6]);
    const no = await call('GET', `/cinemas/${d.id}/booking?groupSize=7`);
    // "Not possible" is a normal answer: HTTP 200, with possible: false.
    assert.equal(no.status, 200);
    assert.equal(no.body.possible, false);

    // Group size 0 is below the allowed minimum: 400.
    assert.equal((await call('GET', `/cinemas/${a.id}/booking?groupSize=0`)).status, 400);
    // Group size 10001 is above the allowed maximum: 400.
    assert.equal((await call('GET', `/cinemas/${a.id}/booking?groupSize=10001`)).status, 400);
    // No groupSize at all: 400.
    assert.equal((await call('GET', `/cinemas/${a.id}/booking`)).status, 400);
    // A cinema id that doesn't exist: 404.
    assert.equal((await call('GET', `/cinemas/nope/booking?groupSize=3`)).status, 404);
    // A cinema with no bundle sizes: 400.
    assert.equal((await call('POST', '/cinemas', { name: 'e', bundleSizes: [] })).status, 400);
    // A bundle bigger than 500 seats: 400.
    assert.equal((await call('POST', '/cinemas', { name: 'e', bundleSizes: [501] })).status, 400);
    // 11 different sizes (the maximum is 10): 400.
    assert.equal((await call('POST', '/cinemas', { name: 'e', bundleSizes: [1,2,3,4,5,6,7,8,9,10,11] })).status, 400);
    // Same name as the "T-a" cinema created above, in lowercase: 409 duplicate name.
    assert.equal((await call('POST', '/cinemas', { name: 't-a', bundleSizes: [2] })).status, 409);
  } finally { close(); }
});