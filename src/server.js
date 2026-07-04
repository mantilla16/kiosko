const { PORT } = require('./config');
const app = require('./app');

// En local (o cualquier servidor tradicional) arrancamos el listener.
// En Vercel (serverless) no se llama a listen: se exporta la app como handler.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  Sistema del Kiosco - Caballeriza');
    console.log(`  Servidor activo en: http://localhost:${PORT}`);
    console.log('========================================');
  });
}

module.exports = app;
