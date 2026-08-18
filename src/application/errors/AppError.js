class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Invalid request') {
    super(message, 400);
  }
}

class VerificationFailedError extends AppError {
  constructor(message = 'WebAuthn verification failed') {
    super(message, 401);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

module.exports = { AppError, NotFoundError, ValidationError, VerificationFailedError, ConflictError };
