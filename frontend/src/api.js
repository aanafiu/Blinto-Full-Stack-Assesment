// One shared helper that every API call goes through.
// `path` is the part after /api (e.g. '/movies'). `options` is the extra fetch settings
// (method, body...). `= {}` means: if nobody passes options, use an empty object (a plain GET).
// It is `async` because it waits for the network, so it returns a Promise.
async function request(path, options = {}) {
  // `fetch` is built into the browser. It sends the HTTP request and waits for the response headers.
  // The URL starts with /api and has no host, so it goes to the same address the page came from:
  // in development the Vite proxy forwards it to :4000, and in Docker nginx forwards it to the backend.
  // The backticks let ${path} be filled in.
  const res = await fetch(`/api${path}`, {
    // Tell the server that any body we send is JSON.
    headers: { 'Content-Type': 'application/json' },
    // Spread the caller's options (method, body) into this object.
    // `...options` comes last, so the caller's values win if both define the same key.
    ...options,
  });
  // 204 means "success, no content" (a successful delete). There is no body to read,
  // so return null here; calling res.json() on an empty body would throw.
  if (res.status === 204) return null;
  // Read the body as JSON. If it isn't valid JSON (for example an HTML error page from a proxy),
  // `.catch(() => null)` turns the failure into null, so the code below can still run.
  const data = await res.json().catch(() => null);
  // `res.ok` is true for status 200-299. Anything else (400, 404, 409, 500) is a failure.
  if (!res.ok) {
    // Build a normal JavaScript Error. Its message is the server's error message when there is one.
    // `?.` means "if this exists": it stops safely instead of crashing when `data` is null.
    // `||` is the fallback: a generic message with the status number.
    const err = new Error(data?.error?.message || `Request failed (${res.status})`);
    // Attach the server's short error code (e.g. "CIRCULAR_DEPENDENCY") so views can react to it.
    err.code = data?.error?.code;
    // Throw it. Inside `async` code, the caller's `await` turns this into a catch.
    throw err;
  }
  // Success: return the parsed JSON (an object or array) to the caller.
  return data;
}

// The list of API calls the views can use. `export` makes `api` importable from other files.
// Each property is a small function that fills in the path, method and body, then calls `request`.
export const api = {
  // GET /api/movies. No options, so it is a plain GET.
  listMovies: () => request('/movies'),
  // POST /api/movies. JSON.stringify turns the JavaScript object into JSON text for the body.
  createMovie: (movie) => request('/movies', { method: 'POST', body: JSON.stringify(movie) }),
  // PATCH /api/movies/<id>. `patch` holds only the fields to change, e.g. { watched: true }.
  updateMovie: (id, patch) => request(`/movies/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  // GET /api/movies/<id>/rewatch-order.
  rewatchOrder: (id) => request(`/movies/${id}/rewatch-order`),
  // GET /api/cinemas.
  listCinemas: () => request('/cinemas'),
  // POST /api/cinemas.
  createCinema: (cinema) => request('/cinemas', { method: 'POST', body: JSON.stringify(cinema) }),
  // GET /api/cinemas/<id>/booking?groupSize=44.
  // encodeURIComponent makes the value safe inside a URL (a space or "&" can't break the query string).
  booking: (id, groupSize) => request(`/cinemas/${id}/booking?groupSize=${encodeURIComponent(groupSize)}`),
};