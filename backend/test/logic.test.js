// Node's built-in test runner. `test(name, function)` defines one test.
// `node --test` (which `npm test` runs) finds these and runs them. No Jest or Mocha needed.
const test = require('node:test');
// Node's built-in assertion library. The "/strict" version makes `equal` compare with ===
// (so the number 2 and the text "2" are different) and `deepEqual` compare whole objects/arrays.
// A failed assertion throws an error, and the test is marked as failed.
const assert = require('node:assert/strict');
// The function under test: the booking dynamic programming.
const { minBundles } = require('../src/lib/bundles');
// The two graph functions under test.
const { wouldCreateCycle, rewatchOrder } = require('../src/lib/graph');

// Test helper: add up the seats in a quote. `q.breakdown` looks like [{size: 3, count: 2}].
// `reduce` walks the list keeping a running total `s`, starting at 0, and adds size × count for each item.
// Used to check that a quote's seats add up EXACTLY to the group size.
const total = (q) => q.breakdown.reduce((s, b) => s + b.size * b.count, 0);

// ---------- Test 1: the four examples from the assessment ----------
test('bundles: spec examples', () => {
  // `let` because we reassign `q` for each example below.
  // Example 1: sizes 1,3,4 and group 6. Expected: 2 bundles, 3 × 2.
  let q = minBundles([1, 3, 4], 6);
  // The fewest number of bundles must be exactly 2.
  assert.equal(q.totalBundles, 2);
  // The breakdown must be exactly one entry: size 3, bought twice.
  assert.deepEqual(q.breakdown, [{ size: 3, count: 2 }]);

  // Example 2: sizes 2,5 and group 11. Expected: 4 bundles, 5 × 1 and 2 × 3 (5 + 6 = 11).
  q = minBundles([2, 5], 11);
  assert.equal(q.totalBundles, 4);
  // The breakdown is sorted biggest size first, so 5 comes before 2.
  assert.deepEqual(q.breakdown, [{ size: 5, count: 1 }, { size: 2, count: 3 }]);

  // Example 3: sizes 6,9,20 and group 44. Expected: 4 bundles (20 + 18 + 6 = 44).
  q = minBundles([6, 9, 20], 44);
  assert.equal(q.totalBundles, 4);
  assert.deepEqual(q.breakdown, [{ size: 20, count: 1 }, { size: 9, count: 2 }, { size: 6, count: 1 }]);

  // Example 4: sizes 4,6 and group 7. Every reachable total is even, so 7 is impossible.
  // The function must return null (which the service turns into `possible: false`).
  assert.equal(minBundles([4, 6], 7), null);
});

// ---------- Test 2: extra checks beyond the examples ----------
test('bundles: always sums exactly and beats greedy', () => {
  // A list of [sizes, group] cases. The `for ... of` with `[sizes, n]` unpacks each pair.
  for (const [sizes, n] of [[[1, 3, 4], 6], [[7, 13], 100], [[500], 10000], [[1], 10000], [[3, 7, 11], 29]]) {
    // Run the algorithm on this case.
    const q = minBundles(sizes, n);
    // If a combination exists, its seats must add up to EXACTLY n (nobody pays for an empty seat).
    // If none exists (q is null), we simply skip the check.
    if (q) assert.equal(total(q), n);
  }
  // Largest limits: 10,000 seats with only 500-seat bundles = exactly 20 bundles.
  assert.equal(minBundles([500], 10000).totalBundles, 20);
  // 9,999 is not a multiple of 500, so it must be impossible (null).
  assert.equal(minBundles([500], 9999), null);
});

// Test helper: build the Map that the graph functions expect, from a short description.
// Input looks like { b: ['a'], c: ['b'] } meaning "b needs a" and "c needs b".
// Object.entries(...) turns it into [['b', ['a']], ['c', ['b']]]; `.map` converts each pair into
// [id, { id, prerequisites }]; `new Map(...)` makes the id -> movie lookup the algorithms use.
const graph = (edges) => new Map(Object.entries(edges).map(([id, prerequisites]) => [id, { id, prerequisites }]));

// ---------- Test 3: cycle detection ----------
test('graph: cycle detection', () => {
  // A small chain: a needs nothing, b needs a, c needs b.
  const g = graph({ a: [], b: ['a'], c: ['b'] });
  // "What if we make `a` depend on `c`?" c needs b needs a, so a would need itself: a cycle. Expect true.
  assert.equal(wouldCreateCycle(g, 'a', ['c']), true); // a -> c -> b -> a
  // "What if `a` depends on itself?" That is a cycle, too. Expect true.
  assert.equal(wouldCreateCycle(g, 'a', ['a']), true); // self
  // "What if `c` depends on `a`?" a needs nothing, so we never come back to c: no cycle. Expect false.
  assert.equal(wouldCreateCycle(g, 'c', ['a']), false);
});

// ---------- Test 4: rewatch order ----------
test('graph: diamond returns each prerequisite once, in valid order', () => {
  // A small MCU-like graph (short names for the movies):
  //   avengers needs ironman and tfa; civil needs avengers; iw (Infinity War) needs civil and rag.
  const g = graph({ ironman: [], tfa: [], avengers: ['ironman', 'tfa'], civil: ['avengers'], rag: [], iw: ['civil', 'rag'] });
  // Ask for the rewatch order of Infinity War.
  const order = rewatchOrder(g, 'iw');
  // There are exactly 5 other movies in the graph, so 5 should come back.
  assert.equal(order.length, 5);
  // A Set drops duplicates, so a Set of the same size means every movie appeared once.
  assert.equal(new Set(order).size, 5);
  // The target itself must NOT be in the list.
  assert.ok(!order.includes('iw'));
  // Helper: where a movie sits in the answer (0 = first).
  const pos = (x) => order.indexOf(x);
  // Order rules: ironman and tfa both come before avengers, and avengers comes before civil.
  // (`&&` means all three must be true.)
  assert.ok(pos('ironman') < pos('avengers') && pos('tfa') < pos('avengers') && pos('avengers') < pos('civil'));
});

// ---------- Test 5: a huge chain ----------
test('graph: very long chain does not overflow the stack', () => {
  // Build a chain m0 <- m1 <- m2 <- ... <- m49999 (each movie needs the one before it).
  const edges = {};
  // For each i: m0 needs nothing; every other mi needs m(i-1).
  for (let i = 0; i < 50000; i++) edges[`m${i}`] = i === 0 ? [] : [`m${i - 1}`];
  // The rewatch order of the last movie should hold all 49,999 movies before it.
  // A recursive version would crash with "Maximum call stack size exceeded"; ours uses its own stack.
  assert.equal(rewatchOrder(graph(edges), 'm49999').length, 49999);
});