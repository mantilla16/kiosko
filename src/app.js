const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');

const app = express();

// CORS: si no se configuran orígenes en CORS_ORIGIN, se sirve solo al mismo origen
// (el frontend vive en este mismo servidor, así que no hace falta CORS abierto).
app.use(cors({ origin: config.CORS_ORIGIN.length ? config.CORS_ORIGIN : false }));
app.use(express.json({ limit: '1mb' }));

// API REST
app.use('/api', require('./routes'));

// Frontend (dashboard) servido como archivos estáticos
app.use(express.static(path.join(__dirname, '..', 'public')));

// Manejo central de errores
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  // Errores conocidos de Prisma
  if (err.code === 'P2002') {
    return res.status(400).json({ error: 'Ya existe un registro con ese valor único.' });
  }
  res.status(status).json({ error: err.message || 'Error interno del servidor.' });
});

module.exports = app;
