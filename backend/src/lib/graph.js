/**
 * Prerequisite graph helpers (hand-written, no graph libraries).
 * A movie is a node; "A has prerequisite B" is an edge A -> B.
 * `byId` is a Map<id, { id, prerequisites: string[] }>.
 */

// ---------------------------------------------------------------
// FUNCTION 1: wouldCreateCycle
// Question it answers: "If I give movie `movieId` these new
// prerequisites, will the movies end up depending on each other
// in a circle?"  (true = yes, reject it; false = safe)
// ---------------------------------------------------------------
function wouldCreateCycle(byId, movieId, newPrereqIds) {
  // `stack` is our to-do list of movies to check.
  // We start with the new prerequisites. [...x] makes a copy, so we
  // don't change the caller's original array.
  const stack = [...newPrereqIds];

  // `seen` remembers movies we already checked, so we never check
  // the same movie twice (this also stops endless looping).
  const seen = new Set();

  // Keep going while the to-do list has something in it.
  while (stack.length) {
    // Take the LAST movie off the to-do list. (This "last in, first
    // out" behaviour is what makes it a depth-first search.)
    const id = stack.pop();

    // If we reach the movie we are editing, we walked a loop:
    // movieId -> ... -> movieId. That is a cycle.
    if (id === movieId) return true;

    // Already checked this movie? Skip it and take the next one.
    if (seen.has(id)) continue;

    // Mark it as checked.
    seen.add(id);

    // Look up the movie object by its id. (A Map lets us do this fast.)
    const movie = byId.get(id);

    // Add ITS prerequisites to the to-do list, so we follow the
    // chain further back. `...` spreads the array into separate items.
    if (movie) stack.push(...movie.prerequisites);
  }

  // The to-do list is empty and we never reached movieId, so no cycle.
  return false;
}

// ---------------------------------------------------------------
// FUNCTION 2: rewatchOrder
// Question it answers: "What must I watch before `targetId`, and in
// what order?" Each movie once, prerequisites first, target excluded.
// ---------------------------------------------------------------
function rewatchOrder(byId, targetId) {
  // `order` is the final answer list we fill in.
  const order = [];

  // Movies we have already discovered. We pre-add the target so it
  // can never be added to the answer.
  const visited = new Set([targetId]);

  // Our to-do list. Each item is a "frame": which movie we are on
  // (`id`) and which of its prerequisites we will look at next
  // (`next`, a position number starting at 0).
  // We use our own stack instead of recursion, so a very long chain
  // of movies can't crash the program ("stack overflow").
  const stack = [{ id: targetId, next: 0 }];

  while (stack.length) {
    // PEEK at the top frame without removing it (length - 1 = last item).
    const frame = stack[stack.length - 1];

    // Get this movie's prerequisites. `?.` means "if the movie exists";
    // `?? []` means "otherwise use an empty list" (a safety net).
    const prereqs = byId.get(frame.id)?.prerequisites ?? [];

    if (frame.next < prereqs.length) {
      // CASE A: this movie still has a prerequisite we haven't looked at.
      // Take it, then move the position forward by one (`next++`).
      const child = prereqs[frame.next++];

      // Only go into it if it is new and really exists.
      if (!visited.has(child) && byId.has(child)) {
        visited.add(child);
        // Put it on top: we now go deeper into this prerequisite first.
        stack.push({ id: child, next: 0 });
      }
    } else {
      // CASE B: we have looked at ALL prerequisites of this movie, so
      // everything it needs is already in `order`. Remove it from the
      // stack...
      stack.pop();
      // ...and add it to the answer (except the target itself).
      // Adding it only AFTER its prerequisites is what guarantees the
      // right order. This is called "post-order".
      if (frame.id !== targetId) order.push(frame.id);
    }
  }

  return order;
}

// Make both functions available to other files.
module.exports = { wouldCreateCycle, rewatchOrder };