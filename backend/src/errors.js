// Define our own error type called ApiError.
// `extends Error` means it inherits everything JavaScript's built-in Error has
// (the message, the stack trace, and the ability to be thrown with `throw`).
class ApiError extends Error {
  // The constructor runs when we write `new ApiError(...)`.
  // It takes four values: the HTTP status number (e.g. 409), a short machine-readable
  // code (e.g. "CIRCULAR_DEPENDENCY"), a human message, and optional extra details.
  constructor(status, code, message, details) {
    // Call the parent Error constructor and give it the message.
    // This must come first. It sets up `this.message` and the stack trace.
    super(message);
    // Store the HTTP status on the error, so the error handler knows which one to send.
    this.status = status;
    // Store the short error code, so the frontend can tell error types apart.
    this.code = code;
    // Store optional extra info (for example the list of validation problems).
    // If nobody passes it, it stays undefined and is left out of the JSON reply.
    this.details = details;
  }
}
// Make the class available to other files (`const { ApiError } = require('./errors')`).
module.exports = { ApiError };


// error handle example
// class ApiError extends Error {
//   constructor(status, code, message, details) {
//     super(message);
//     this.status = status;
//     this.code = code;
//     this.details = details;
//   }
// }

// try {
//   throw new ApiError(409, 'DUPLICATE_TITLE', 'Iron Man already exists');
// } catch (e) {
//   console.log(e.message); // Iron Man already exists   (came from Error, via super)
//   console.log(e.status);  // 409                       (our own field)
//   console.log(e.code);    // DUPLICATE_TITLE           (our own field)
//   console.log(e.details); // undefined                 (nobody passed it)
// }