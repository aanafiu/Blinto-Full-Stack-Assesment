// Load Node's built-in "fs" (file system) module, used to read and write files.
const fs = require('fs');
// Load Node's built-in "path" module, used to work with file and folder paths.
const path = require('path');

// A class is a blueprint. `new Store(file)` makes one store object that holds all the app's data.
class Store {
  // The constructor runs once, when you write `new Store(...)`.
  // file = null means: if no file path is given, use null (in-memory only, as in the tests).
  constructor(file = null) {
    // Remember the file path on this object, so other methods can use it later.
    this.file = file;
    // Start with empty lists. This is the whole database: one object, two arrays.
    this.data = { movies: [], cinemas: [] };
    // If a path was given AND that file already exists on disk (from an earlier run)...
    if (file && fs.existsSync(file)) {
      // ...read the file as text, convert the text into a JavaScript object,
      // and use it as our data. This is how data survives a server restart.
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  }

  // Makes a copy of the data that services can change freely
  snapshot() {
    // JSON.stringify turns the data into text; JSON.parse turns the text back into a NEW object.
    // The result shares nothing with the original, so editing the draft cannot touch the real data.
    return JSON.parse(JSON.stringify(this.data));
  }

  // Replaces the real data with a draft that passed all the rules, then saves it.
  commit(next) {
    // Swap the old data for the new draft. If a service throws an error before reaching
    // this line, the real data is never touched.
    this.data = next;
    // Write the new data to the file.
    this.persist();
  }

  // Saves the current data to disk.
  persist() {

    if (!this.file) return;

    // Make sure the folder exists (for example backend/data). `recursive: true` also
    // creates missing parent folders and does not fail if the folder is already there.
    fs.mkdirSync(path.dirname(this.file), { recursive: true });

    // Pick a temporary file name next to the real one, e.g. db.json.tmp.
    const tmp = `${this.file}.tmp`;
    // Write the data as readable JSON into the TEMP file first.
    // `null, 2` means: no filter, indent with 2 spaces.
    
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    // Rename the temp file over the real one. A rename is a single step, so the real file
    // is never left half-written if the program crashes mid-save. This is the "atomic write".
    fs.renameSync(tmp, this.file);
  }

  // Tells the caller whether the database has no data at all (used to decide on seeding).
  isEmpty() {
    // True only when BOTH lists have zero items.
    return this.data.movies.length === 0 && this.data.cinemas.length === 0;
  }
}

// Make the Store class available to other files (`const { Store } = require('./store')`).
module.exports = { Store };