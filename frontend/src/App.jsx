// Import three React "hooks" (special functions that give a component memory and side effects):
//  - useState:    lets the component remember values between renders
//  - useEffect:   runs code after the component appears on the screen (here: load the data)
//  - useCallback: keeps the same function object between renders, unless its inputs change
import { useCallback, useEffect, useState } from 'react';
// Our API helper from api.js (the only file that talks to the backend).
import { api } from './api.js';
// The three screens. Each one is a React component in its own file.
import MoviesView from './views/MoviesView.jsx';
import RewatchView from './views/RewatchView.jsx';
import BookingView from './views/BookingView.jsx';

// The tab buttons, described as data. `id` is used in code; `label` is the text people see.
// Keeping them in a list means the buttons are created with a loop, not copy-pasted three times.
const TABS = [
  { id: 'movies', label: 'Movies' },
  { id: 'rewatch', label: 'Rewatch Plan' },
  { id: 'booking', label: 'Booking' },
];

// The main component. `export default` lets main.jsx import it as `App`.
export default function App() {
  // `tab` = which tab is open now. `setTab` changes it. 'movies' is the starting tab.
  // Calling a setter makes React run this function again and redraw the screen.
  const [tab, setTab] = useState('movies');
  // The list of movies from the API. Starts as an empty list until the data arrives.
  const [movies, setMovies] = useState([]);
  // The list of cinemas from the API. Starts empty.
  const [cinemas, setCinemas] = useState([]);
  // The error message to show at the top. An empty text '' means "no error".
  const [loadError, setLoadError] = useState('');

  // `refresh` loads both lists from the API and stores them in state.
  // The views call it after they change something (add a movie, tick watched, add a cinema).
  // useCallback(..., []) means: create this function once and reuse it. This matters because
  // `refresh` is listed in the useEffect dependency list below; a new function on every render
  // would make the effect re-run on every render and call the API again and again.
  const refresh = useCallback(async () => {
    try {
      // Ask for movies and cinemas AT THE SAME TIME (not one after the other), and wait for both.
      // `const [m, c] = ...` unpacks the two results: m = movies, c = cinemas.
      const [m, c] = await Promise.all([api.listMovies(), api.listCinemas()]);
      // Save them in state. This makes React redraw with the new data.
      setMovies(m);
      setCinemas(c);
      // Clear any old error, because this load worked.
      setLoadError('');
    } catch (err) {
      // Either request failed (for example the backend isn't running): show a message.
      setLoadError(`Could not reach the API: ${err.message}`);
    }
  }, []);

  // Run code after the first time the component is drawn.
  useEffect(() => {
    // Load the data from the API.
    refresh();
    // The list in [] says "re-run this effect only if `refresh` changes".
    // Since `refresh` is created once, this effectively runs only one time, on page load.
  }, [refresh]);

  // What the component draws. This is JSX: HTML-like code that React turns into real page elements.
  // `className` is used instead of `class`, because `class` is a reserved word in JavaScript.
  return (
    <div className="app">
      <header>
        <h1>Doomsday Ready</h1>
        <p>Plan your MCU rewatch and book the opening-night watch party.</p>
      </header>
      <nav>
        {/* Curly braces in JSX run JavaScript. `.map` loops over TABS and returns one button per tab. */}
        {TABS.map((t) => (
          // `key` helps React tell list items apart when it updates them. It must be unique in the list.
          // The class is 'tab active' for the open tab (so CSS can highlight it) and 'tab' for the others.
          // onClick calls setTab with this button's id, which switches the open tab.
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {/* `a && b` shows b only when a is truthy. An empty '' error is falsy, so nothing appears.
          role="alert" tells screen readers to announce the message immediately. */}
      {loadError && <div className="error" role="alert">{loadError}</div>}
      <main>
        {/* Only the view for the open tab is drawn; the other two are not drawn at all.
            Data and the refresh function are passed down as "props" (inputs to a component). */}
        {tab === 'movies' && <MoviesView movies={movies} refresh={refresh} />}
        {tab === 'rewatch' && <RewatchView movies={movies} />}
        {tab === 'booking' && <BookingView cinemas={cinemas} refresh={refresh} />}
      </main>
    </div>
  );
}