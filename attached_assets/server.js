const express = require('express');
const { Pool } = require('pg');

// Crear la aplicación Express
const app = express();
const PORT = 5001;

// Configuración de conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware para manejar JSON
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
  res.send('Servidor de horarios funcionando');
});

// Ruta para prueba de conexión a la base de datos
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      dbTime: result.rows[0].now
    });
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    res.status(500).json({
      status: 'error',
      message: 'No se pudo conectar con la base de datos'
    });
  }
});

// Iniciar el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor horarios iniciado en puerto ${PORT}`);
}); 