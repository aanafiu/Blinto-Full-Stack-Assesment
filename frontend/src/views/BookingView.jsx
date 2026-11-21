import { useState } from "react";
import { api } from "../api.js";

export default function BookingView({ cinemas, refresh }) {
  const [cinemaId, setCinemaId] = useState("");
  const [groupSize, setGroupSize] = useState("");
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [newCinema, setNewCinema] = useState({ name: "", sizes: "" });

  const getQuote = async (e) => {
    e.preventDefault();
    try {
      setQuote(await api.booking(cinemaId, groupSize));
      setError("");
    } catch (err) {
      setError(err.message);
      setQuote(null);
    }
  };

  const addCinema = async (e) => {
    e.preventDefault();
    try {
      const bundleSizes = newCinema.sizes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number);
      await api.createCinema({ name: newCinema.name, bundleSizes });
      setNewCinema({ name: "", sizes: "" });
      setError("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <h2>Book the watch party</h2>
      <form onSubmit={getQuote} className="card form">
        <select
          value={cinemaId}
          onChange={(e) => {
            setCinemaId(e.target.value);
            setQuote(null);
          }}
          required
        >
          <option value="">Pick a cinema…</option>
          {cinemas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (bundles: {c.bundleSizes.join(", ")})
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          max="10000"
          placeholder="Group size (1-10,000)"
          value={groupSize}
          onChange={(e) => setGroupSize(e.target.value)}
          required
        />
        <button type="submit">Get quote</button>
      </form>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {quote && (
        <div className="card">
          {quote.possible ? (
            <>
              <p>
                <strong>
                  {quote.totalBundles} bundle
                  {quote.totalBundles === 1 ? "" : "s"}
                </strong>{" "}
                for {quote.groupSize} seats at {quote.cinemaName}:
              </p>
              <ul className="list">
                {quote.breakdown.map((b) => (
                  <li key={b.size}>
                    {b.size} × {b.count}{" "}
                    <span className="muted">(= {b.size * b.count} seats)</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              <strong>Not possible.</strong> {quote.message}
            </p>
          )}
        </div>
      )}

      <h2>Add a cinema</h2>
      <form onSubmit={addCinema} className="card form">
        <input
          placeholder="Cinema name"
          value={newCinema.name}
          onChange={(e) => setNewCinema({ ...newCinema, name: e.target.value })}
          required
        />
        <input
          placeholder="Bundle sizes, e.g. 2, 5"
          value={newCinema.sizes}
          onChange={(e) =>
            setNewCinema({ ...newCinema, sizes: e.target.value })
          }
          required
        />
        <button type="submit">Add cinema</button>
      </form>
    </section>
  );
}
