// Sample data from the assessment (not an official MCU watch guide).
// Avengers: Doomsday's runtime/year are placeholders.
const movies = [
  { title: 'Iron Man', releaseYear: 2008, runtimeMinutes: 126 },
  { title: 'Captain America: The First Avenger', releaseYear: 2011, runtimeMinutes: 124 },
  { title: 'The Avengers', releaseYear: 2012, runtimeMinutes: 143, prerequisites: ['Iron Man', 'Captain America: The First Avenger'] },
  { title: 'Captain America: Civil War', releaseYear: 2016, runtimeMinutes: 147, prerequisites: ['The Avengers'] },
  { title: 'Thor: Ragnarok', releaseYear: 2017, runtimeMinutes: 130 },
  { title: 'Avengers: Infinity War', releaseYear: 2018, runtimeMinutes: 149, prerequisites: ['Captain America: Civil War', 'Thor: Ragnarok'] },
  { title: 'Avengers: Endgame', releaseYear: 2019, runtimeMinutes: 181, prerequisites: ['Avengers: Infinity War'] },
  { title: 'Avengers: Doomsday', releaseYear: 2026, runtimeMinutes: 150, prerequisites: ['Avengers: Endgame'] },
];

const cinemas = [
  { name: 'Star Cineplex', bundleSizes: [2, 5] },
  { name: 'Blockbuster Hall', bundleSizes: [1, 3, 4] },
  { name: 'Grand Premiere', bundleSizes: [6, 9, 20] },
  { name: 'Odd Seats Cinema', bundleSizes: [4, 6] },
];

module.exports = { movies, cinemas };
