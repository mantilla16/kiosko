// Error de negocio con código HTTP, usado por los servicios
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = ApiError;
