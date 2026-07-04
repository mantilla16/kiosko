const ApiError = require('../utils/ApiError');

// Middleware que valida (y normaliza) req.body contra un schema de zod.
// Si falla, responde 400 con el primer mensaje de error legible.
// Reemplaza req.body por los datos ya parseados/convertidos por el schema.
module.exports = function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const campo = issue.path.length ? `"${issue.path.join('.')}": ` : '';
      return next(new ApiError(400, `${campo}${issue.message}`));
    }
    req.body = result.data;
    next();
  };
};
