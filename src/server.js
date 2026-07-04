const { PORT } = require('./config');
const app = require('./app');

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  Sistema del Kiosco - Caballeriza');
  console.log(`  Servidor activo en: http://localhost:${PORT}`);
  console.log('========================================');
});
