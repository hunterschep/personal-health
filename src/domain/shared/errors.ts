export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The submitted information is not valid.", options?: ErrorOptions) {
    super(message, "VALIDATION_ERROR", 400, options);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Please sign in to continue.", options?: ErrorOptions) {
    super(message, "AUTHENTICATION_REQUIRED", 401, options);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Wait before trying again.", options?: ErrorOptions) {
    super(message, "RATE_LIMITED", 429, options);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "This resource is not available.", options?: ErrorOptions) {
    super(message, "RESOURCE_UNAVAILABLE", 404, options);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "This resource is not available.", options?: ErrorOptions) {
    super(message, "NOT_FOUND", 404, options);
  }
}

export class ConflictError extends AppError {
  constructor(message = "This change conflicts with a newer update.", options?: ErrorOptions) {
    super(message, "CONFLICT", 409, options);
  }
}

export class ExternalSourceError extends AppError {
  constructor(message = "Source content is temporarily unavailable.", options?: ErrorOptions) {
    super(message, "EXTERNAL_SOURCE_UNAVAILABLE", 503, options);
  }
}
