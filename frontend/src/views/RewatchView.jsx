import { useEffect, useState } from "react";
import { api } from "../api.js";

const fmt = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

export default function RewatchView({ movies }) {
  const [targetId, setTargetId] = useState("");
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  const load = async (id) => {
    if (!id) return setPlan(null);
    try {
      setPlan(await api.rewatchOrder(id));
      setError("");
    } catch (err) {
      setError(err.message);
      setPlan(null);
    }
  };

  // Re-fetch when the target changes or movies change (e.g. watched toggled elsewhere).
  useEffect(() => {
    load(targetId);
  }, [targetId, movies]);

  const toggleWatched = async (m) => {
    try {
      await api.updateMovie(m.id, { watched: !m.watched });
      await load(targetId);
    } catch (err) {
      setError(err.message);
    }
  };

  const pct =
    plan && plan.totalCount
      ? Math.round((plan.watchedCount / plan.totalCount) * 100)
      : 100;

  return (
    <section>
      <h2>Rewatch plan</h2>
      <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
        <option value="">Pick a target movie…</option>
        {movies.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title}
          </option>
        ))}
      </select>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {plan && (
        <div className="card">
          <p>
            <strong>
              {plan.watchedCount} of {plan.totalCount} watched
            </strong>
            {plan.totalCount > 0 && (
              <>
                {" "}
                · Remaining watch time:{" "}
                <strong>{fmt(plan.remainingMinutes)}</strong>
              </>
            )}
          </p>
          <div className="bar" aria-label="progress">
            <div style={{ width: `${pct}%` }} />
          </div>
          {plan.order.length === 0 ? (
            <p className="muted">
              Nothing to rewatch before {plan.target.title}. You're ready!
            </p>
          ) : (
            <ol className="list">
              {plan.order.map((m) => (
                <li key={m.id} className="row">
                  <label className="watch">
                    <input
                      type="checkbox"
                      checked={m.watched}
                      onChange={() => toggleWatched(m)}
                    />
                    <span className={m.watched ? "done" : ""}>{m.title}</span>
                  </label>
                  <span className="muted">{m.runtimeMinutes} min</span>
                </li>
              ))}
            </ol>
          )}
          <p className="muted small">
            Then: <strong>{plan.target.title}</strong>
          </p>
        </div>
      )}
    </section>
  );
}
