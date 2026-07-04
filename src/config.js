// Configuración central del sistema. Lee y valida las variables de entorno
// una sola vez al arrancar. Si falta algo crítico, la app NO arranca.
require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`\n[ERROR DE CONFIGURACIÓN] Falta la variable de entorno "${name}".`);
    console.error('Revisa tu archivo .env (puedes copiar .env.example como base).\n');
    process.exit(1);
  }
  return value.trim();
}

const JWT_SECRET = required('JWT_SECRET');
if (JWT_SECRET === 'kiosco_caballeriza_jwt_2026_secret') {
  console.error('\n[ERROR DE SEGURIDAD] El JWT_SECRET es el valor de ejemplo.');
  console.error('Genera uno propio con:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  console.error('y ponlo en tu archivo .env.\n');
  process.exit(1);
}

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  // Orígenes permitidos para CORS. Vacío = solo mismo origen (recomendado, ya que
  // el frontend se sirve desde el mismo servidor). Ej: "https://midominio.com,https://otro.com"
  CORS_ORIGIN: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
  NODE_ENV: process.env.NODE_ENV || 'development',
};
