import { useState } from "react";
import { api } from "../api.js";

const EMPTY = {
  title: "",
  releaseYear: "",
  runtimeMinutes: "",
  prerequisites: [],
};

function PrereqPicker({ movies, selected, onChange, excludeId }) {
  const toggle = (id) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  const options = movies.filter((m) => m.id !== excludeId);
  if (!options.length) return <em className="muted">No other movies yet</em>;
  return (
    <div className="checks">
      {options.map((m) => (
        <label key={m.id}>
          <input
            type="checkbox"
            checked={selected.includes(m.id)}
            onChange={() => toggle(m.id)}
          />{" "}
          {m.title}
        </label>
      ))}
    </div>
  );
}

function MovieRow({ movie, movies, refresh, setError }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(movie.prerequisites);
  const titleOf = (id) => movies.find((m) => m.id === id)?.title ?? "Unknown";

  const toggleWatched = async () => {
    try {
      await api.updateMovie(movie.id, { watched: !movie.watched });
      setError("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const savePrereqs = async () => {
    try {
      await api.updateMovie(movie.id, { prerequisites: draft });
      setError("");
      setEditing(false);
      refresh();
    } catch (err) {
      setError(
        err.code === "CIRCULAR_DEPENDENCY"
          ? `Circular dependency: ${err.message}`
          : err.message,
      );
    }
  };

  return (
    <li className="card">
      <div className="row">
        <label className="watch">
          <input
            type="checkbox"
            checked={movie.watched}
            onChange={toggleWatched}
          />
          <strong className={movie.watched ? "done" : ""}>{movie.title}</strong>
        </label>
        <span className="muted">
          {movie.releaseYear} · {movie.runtimeMinutes} min
        </span>
      </div>
      <div className="muted small">
        Watch first:{" "}
        {movie.prerequisites.length
          ? movie.prerequisites.map(titleOf).join(", ")
          : "nothing"}
      </div>
      {editing ? (
        <div className="editor">
          <PrereqPicker
            movies={movies}
            selected={draft}
            onChange={setDraft}
            excludeId={movie.id}
          />
          <button onClick={savePrereqs}>Save</button>{" "}
          <button
            className="secondary"
            onClick={() => {
              setEditing(false);
              setDraft(movie.prerequisites);
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="link"
          onClick={() => {
            setDraft(movie.prerequisites);
            setEditing(true);
          }}
        >
          Edit prerequisites
        </button>
      )}
    </li>
  );
}

export default function MoviesView({ movies, refresh }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.createMovie({
        title: form.title,
        releaseYear: Number(form.releaseYear),
        runtimeMinutes: Number(form.runtimeMinutes),
        prerequisites: form.prerequisites,
      });
      setForm(EMPTY);
      setError("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <section>
      <h2>Add a movie</h2>
      <form onSubmit={submit} className="card form">
        <input
          placeholder="Title"
          value={form.title}
          onChange={set("title")}
          required
        />
        <input
          type="number"
          placeholder="Release year"
          value={form.releaseYear}
          onChange={set("releaseYear")}
          required
        />
        <input
          type="number"
          placeholder="Runtime (1-300 min)"
          min="1"
          max="300"
          value={form.runtimeMinutes}
          onChange={set("runtimeMinutes")}
          required
        />
        <div>
          <div className="muted small">Prerequisites (optional)</div>
          <PrereqPicker
            movies={movies}
            selected={form.prerequisites}
            onChange={(p) => setForm({ ...form, prerequisites: p })}
          />
        </div>
        <button type="submit">Add movie</button>
      </form>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <h2>Movies ({movies.length})</h2>
      <ul className="list">
        {movies.map((m) => (
          <MovieRow
            key={m.id}
            movie={m}
            movies={movies}
            refresh={refresh}
            setError={setError}
          />
        ))}
      </ul>
      {!movies.length && (
        <p className="muted">No movies yet. Add your first one above.</p>
      )}
    </section>
  );
}
