require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { validateClubData } = require('./src/validator');
const googleService = require('./src/googleService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Configurar multer en memoria para procesar fotos sin guardar basura temporal en disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB por archivo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error(`El archivo ${file.originalname} no es una imagen válida (debe ser JPG, PNG, WEBP).`));
    }
  }
});

/**
 * GET /api/health
 * Verificación de salud y estado de la configuración
 */
app.get('/api/health', (req, res) => {
  const status = googleService.getStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    google: status
  });
});

/**
 * GET /api/submissions
 * Lista los registros almacenados (útil para auditoría o visualización)
 */
app.get('/api/submissions', (req, res) => {
  const dataFile = path.join(__dirname, 'data', 'local_submissions.json');
  if (fs.existsSync(dataFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      return res.json({ count: data.length, submissions: data });
    } catch {
      return res.json({ count: 0, submissions: [] });
    }
  }
  res.json({ count: 0, submissions: [] });
});

/**
 * POST /api/register
 * Endpoint principal para registro de Club y Jugadores
 */
app.post('/api/register', upload.any(), async (req, res) => {
  try {
    const clubName = req.body.clubName || '';
    let playersMeta = [];

    // Los datos de los jugadores se envían como JSON string en el campo `players`
    if (typeof req.body.players === 'string') {
      try {
        playersMeta = JSON.parse(req.body.players);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'El formato de los datos de jugadores es inválido (JSON esperado).'
        });
      }
    } else if (Array.isArray(req.body.players)) {
      playersMeta = req.body.players;
    }

    // Mapear los archivos recibidos con cada jugador
    // Se acepta campo `photo_${index}` o `photos` en orden
    const files = req.files || [];
    const filesByName = {};
    files.forEach(f => {
      filesByName[f.fieldname] = f;
    });

    const parsedPlayers = playersMeta.map((p, idx) => {
      // Buscar por nombre de campo específico 'photo_0', 'photo_1', etc., o por índice en array
      const file = filesByName[`photo_${idx}`] || files[idx];
      return {
        name: p.name,
        carnet: p.carnet,
        photoBuffer: file ? file.buffer : null,
        photoFilename: file ? file.originalname : null,
        mimetype: file ? file.mimetype : 'image/jpeg'
      };
    });

    // Validar datos
    const validation = validateClubData(clubName, parsedPlayers);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Procesar almacenamiento en Drive y Sheets
    const result = await googleService.processClubRegistration(
      validation.cleanClubName,
      validation.cleanPlayers
    );

    res.json({
      success: true,
      message: `¡Club "${validation.cleanClubName}" registrado exitosamente con ${validation.cleanPlayers.length} jugadores!`,
      data: result
    });
  } catch (error) {
    console.error('Error al registrar equipo:', error);
    res.status(500).json({
      success: false,
      error: 'Ocurrió un error en el servidor al procesar el registro.',
      details: error.message
    });
  }
});

// Iniciar servidor solo si no se requiere como módulo (para testing limpio)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`  ⚽ CAMPEONATO DE FUTSAL - PLANILLA Y REGISTRO  `);
    console.log(`  Servidor iniciado en: http://localhost:${PORT}`);
    console.log(`=================================================`);
  });
}

module.exports = app;
