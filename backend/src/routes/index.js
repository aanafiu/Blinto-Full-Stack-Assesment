const express = require("express");
const movies = require("../services/movieService");
const cinemas = require("../services/cinemaService");
const { ApiError } = require("../errors");


// Use /api/ for every single route
// health route is for checking if the server is running


module.exports = function buildRouter(store) {
  const router = express.Router();
// Health check: confirms the API is running
  router.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Create a movie (or an array of movies, all-or-nothing)
  router.post("/movies", (req, res) =>
    res.status(201).json(movies.createMovies(store, req.body)),
  );

  // List all movies
  router.get("/movies", (_req, res) => res.json(store.data.movies));

  // Get one movie by ID
  router.get("/movies/:id", (req, res) => {
    const movie = movies.findMovie(store.data, req.params.id);
    if (!movie) throw new ApiError(404, "NOT_FOUND", "Movie not found");
    res.json(movie);
  });

  // Partially update a movie (title, year, runtime, prerequisites, watched)
  router.patch("/movies/:id", (req, res) =>
    res.json(movies.updateMovie(store, req.params.id, req.body)),
  );

  // Delete a movie and remove it from other movies' prerequisites
  router.delete("/movies/:id", (req, res) => {
    movies.deleteMovie(store, req.params.id);
    res.status(204).end();
  });

  // Rewatch order: every movie to watch before this one, prerequisites first
  router.get("/movies/:id/rewatch-order", (req, res) =>
    res.json(movies.getRewatchOrder(store, req.params.id)),
  );

  // ---- Cinemas ----

  // Create a cinema (or an array of cinemas) with its bundle sizes
  router.post("/cinemas", (req, res) =>
    res.status(201).json(cinemas.createCinemas(store, req.body)),
  );

  // List all cinemas
  router.get("/cinemas", (_req, res) => res.json(store.data.cinemas));

  // Get one cinema by ID
  router.get("/cinemas/:id", (req, res) =>
    res.json(cinemas.findCinema(store, req.params.id)),
  );

  // Booking quote: fewest bundles that exactly fit a group size (?groupSize=44)
  router.get("/cinemas/:id/booking", (req, res) =>
    res.json(
      cinemas.getBookingQuote(store, req.params.id, req.query.groupSize),
    ),
  );

  return router;
};
