// Envuelve controladores async para capturar errores y enviarlos al middleware
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
