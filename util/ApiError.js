class ApiError extends Error {
  constructor(message = "Error Found", statusCode = 500, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;
    this.data = null;
  }
}
export { ApiError };
