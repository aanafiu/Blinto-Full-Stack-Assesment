/**
 * Fewest bundles whose sizes add up to exactly `groupSize` (unbounded coin
 * change with reconstruction). Greedy is NOT correct here (sizes 1,3,4 and
 * group 6: greedy gives 4+1+1 = 3 bundles, the optimum is 3+3 = 2).
 *
 * dp[i]   = minimum bundles to seat exactly i people (Infinity if impossible)
 * pick[i] = the last bundle size used in an optimal solution for i
 * Time O(groupSize * sizes), space O(groupSize).
 *
 * Returns null when no exact combination exists.
 */
// `sizes` = the cinema's bundle sizes, e.g. [6, 9, 20]. `groupSize` = people to seat, e.g. 44.
function minBundles(sizes, groupSize) {
  // Remove duplicates with a Set, turn it back into an array with [...], then sort BIGGEST first.
  // `(a, b) => b - a` sorts numbers in descending order. (Default sort would compare as text.)
  const bundleSizes = [...new Set(sizes)].sort((a, b) => b - a);
  // dp has one slot for every number from 0 to groupSize (that is why `+ 1`).
  // Every slot starts as Infinity, meaning "nobody has found a way to make this number yet".
  const dp = new Array(groupSize + 1).fill(Infinity);
  // pick has the same length. It will remember WHICH bundle size gave the best answer for each number.
  // 0 means "nothing chosen yet".
  const pick = new Array(groupSize + 1).fill(0);
  // Seating 0 people needs 0 bundles. This is the starting point everything else builds on.
  dp[0] = 0;

  // Solve every group size from 1 up to the target, smallest first.
  // Each answer reuses smaller answers that are already filled in.
  for (let seats = 1; seats <= groupSize; seats++) {
    // Try each bundle size as the LAST bundle we buy to reach `seats`.
    for (const size of bundleSizes) {
      // Two conditions, both must hold:
      //  1. size <= seats: the bundle must not be bigger than the group.
      //  2. dp[seats - size] + 1 < dp[seats]: buying this bundle on top of the best answer for
      //     the remaining seats gives FEWER bundles than the best we have found so far.
      // Note: if dp[seats - size] is Infinity, then Infinity + 1 is still Infinity,
      // and Infinity < anything is false, so impossible paths are never picked.
      if (size <= seats && dp[seats - size] + 1 < dp[seats]) {
        // Record the new best count for this number of seats...
        dp[seats] = dp[seats - size] + 1;
        // ...and remember which bundle size gave it (needed to rebuild the answer later).
        pick[seats] = size;
      }
    }
  }
  // If the last slot is still Infinity, no combination reaches the group size exactly.
  // Return null, and the caller turns that into "possible: false".
  if (dp[groupSize] === Infinity) return null;

  // Rebuild HOW MANY of each size were used. A Map stores size -> count.
  const counts = new Map();
  // Start at the full group. Each step: look up which bundle was used last (pick[left]),
  // count it, then subtract it (`left -= pick[left]`) and repeat for what remains.
  // Stop when nothing is left (left reaches 0).
  for (let left = groupSize; left > 0; left -= pick[left]) {
    // counts.get(...) is undefined the first time, so `|| 0` makes it start from 0, then add 1.
    counts.set(pick[left], (counts.get(pick[left]) || 0) + 1);
  }
  // Turn the Map into a list of { size, count } objects, biggest size first.
  // counts.entries() gives [size, count] pairs; `([size, count]) => ({ size, count })` converts each pair
  // into an object (the extra parentheses are needed so JavaScript doesn't read the braces as a code block).
  const breakdown = [...counts.entries()]
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.size - a.size);

  // The fewest number of bundles is stored in the last slot of dp.
  return { totalBundles: dp[groupSize], breakdown };
}

// Make the function available to cinemaService.js.
module.exports = { minBundles };