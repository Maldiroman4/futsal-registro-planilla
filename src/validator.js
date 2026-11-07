/**
 * Validador de datos para el registro de equipos de futsal
 */

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

function validateClubData(clubName, players) {
  const errors = [];
  const cleanClubName = sanitizeString(clubName);

  if (!cleanClubName || cleanClubName.length < 2) {
    errors.push('El nombre del club debe tener al menos 2 caracteres.');
  }

  if (!Array.isArray(players) || players.length === 0) {
    errors.push('Debe registrar al menos un (1) jugador en el equipo.');
    return { isValid: false, errors, cleanClubName, cleanPlayers: [] };
  }

  const cleanPlayers = [];
  const carnetsSeen = new Set();

  players.forEach((p, idx) => {
    const playerNum = idx + 1;
    const name = sanitizeString(p.name);
    const carnet = sanitizeString(p.carnet);
    const photoBuffer = p.photoBuffer;
    const photoFilename = p.photoFilename || `jugador_${playerNum}.jpg`;

    if (!name || name.length < 2) {
      errors.push(`Jugador #${playerNum}: El nombre completo es obligatorio (mínimo 2 letras).`);
    }

    if (!carnet || carnet.length < 3) {
      errors.push(`Jugador #${playerNum}: El número de carnet (CI) es obligatorio (mínimo 3 caracteres).`);
    } else {
      const lowerCarnet = carnet.toLowerCase();
      if (carnetsSeen.has(lowerCarnet)) {
        errors.push(`Jugador #${playerNum}: El carnet "${carnet}" está duplicado en la lista del equipo.`);
      } else {
        carnetsSeen.add(lowerCarnet);
      }
    }

    if (!photoBuffer || !Buffer.isBuffer(photoBuffer) || photoBuffer.length === 0) {
      errors.push(`Jugador #${playerNum}: Falta la fotografía del jugador.`);
    }

    cleanPlayers.push({
      name,
      carnet,
      photoBuffer,
      photoFilename,
      mimetype: p.mimetype || 'image/jpeg'
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    cleanClubName,
    cleanPlayers
  };
}

module.exports = {
  sanitizeString,
  validateClubData
};
