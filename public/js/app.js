/**
 * Lógica del cliente para el Sistema de Registro de Futsal
 */

// Estado global de la aplicación
const state = {
  players: [], // Array de objetos { id, name, carnet, photoBlob, photoPreviewUrl }
  nextId: 1
};

// Elementos del DOM
const elements = {
  form: document.getElementById('registrationForm'),
  clubNameInput: document.getElementById('clubName'),
  playersList: document.getElementById('playersList'),
  btnAddPlayer: document.getElementById('btnAddPlayer'),
  playerCountDisplay: document.getElementById('playerCountDisplay'),
  formErrors: document.getElementById('formErrors'),
  btnSubmit: document.getElementById('btnSubmit'),
  connectionStatus: document.getElementById('connectionStatus'),
  
  // Modales
  loadingModal: document.getElementById('loadingModal'),
  successModal: document.getElementById('successModal'),
  summaryClubName: document.getElementById('summaryClubName'),
  summaryPlayersList: document.getElementById('summaryPlayersList'),
  btnNewRegistration: document.getElementById('btnNewRegistration'),
  btnPrint: document.getElementById('btnPrint')
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  // Iniciar con 5 casillas de jugador (alineación inicial de futsal)
  for (let i = 0; i < 5; i++) {
    addPlayer();
  }
  setupEventListeners();
});

function setupEventListeners() {
  elements.btnAddPlayer.addEventListener('click', () => addPlayer());
  elements.form.addEventListener('submit', handleFormSubmit);
  elements.btnNewRegistration.addEventListener('click', resetForm);
  elements.btnPrint.addEventListener('click', () => window.print());
}

/**
 * Verifica la conectividad con el servidor y Google Cloud
 */
async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    const badge = elements.connectionStatus;
    badge.className = 'status-badge';

    if (data.google && data.google.mode === 'google_cloud') {
      badge.classList.add('google_cloud');
      badge.querySelector('.status-text').textContent = 'Google Drive & Sheets Conectado';
    } else {
      badge.classList.add('local_fallback');
      badge.querySelector('.status-text').textContent = 'Modo Local / Demo Activo';
      badge.title = 'Configura las credenciales en .env para sincronizar con Google Drive';
    }
  } catch (err) {
    const badge = elements.connectionStatus;
    badge.className = 'status-badge';
    badge.querySelector('.status-text').textContent = 'Sin conexión con el servidor';
  }
}

/**
 * Agrega una nueva tarjeta de jugador a la lista
 */
function addPlayer() {
  const playerId = state.nextId++;
  const playerObj = {
    id: playerId,
    name: '',
    carnet: '',
    photoBlob: null,
    photoPreviewUrl: null
  };
  state.players.push(playerObj);

  renderPlayers();
}

/**
 * Elimina un jugador de la lista
 */
function removePlayer(id) {
  if (state.players.length <= 1) {
    showError(['El equipo debe tener al menos un (1) jugador registrado.']);
    return;
  }

  // Liberar objeto URL de memoria si existe
  const player = state.players.find(p => p.id === id);
  if (player && player.photoPreviewUrl) {
    URL.revokeObjectURL(player.photoPreviewUrl);
  }

  state.players = state.players.filter(p => p.id !== id);
  renderPlayers();
}

/**
 * Renderiza todas las tarjetas de jugadores en el DOM
 */
function renderPlayers() {
  elements.playersList.innerHTML = '';
  elements.playerCountDisplay.textContent = state.players.length;

  state.players.forEach((player, index) => {
    const playerNum = index + 1;
    const card = document.createElement('div');
    card.className = 'player-card';
    card.dataset.id = player.id;

    card.innerHTML = `
      <!-- Foto del Jugador -->
      <div class="photo-uploader">
        <div class="photo-preview ${player.photoPreviewUrl ? 'has-photo' : ''}" id="previewBox_${player.id}" title="Haz clic para subir o tomar foto">
          ${
            player.photoPreviewUrl
              ? `<img src="${player.photoPreviewUrl}" alt="Foto de Jugador">`
              : `<div class="photo-placeholder">
                   <span class="camera-icon">📷</span>
                   <span>Foto Jugador</span>
                 </div>`
          }
        </div>
        <input 
          type="file" 
          id="fileInput_${player.id}" 
          class="file-input" 
          accept="image/*" 
          capture="user"
        >
      </div>

      <!-- Datos del Jugador -->
      <div class="player-fields">
        <span class="player-index-badge">Jugador #${playerNum}</span>
        <div class="player-input-row">
          <div class="form-group">
            <label>Nombre Completo <span class="required">*</span></label>
            <input 
              type="text" 
              class="input-player-name" 
              placeholder="Ej. Juan Pérez" 
              value="${escapeHtml(player.name)}" 
              required
            >
          </div>
          <div class="form-group">
            <label>N° de Carnet (CI) <span class="required">*</span></label>
            <input 
              type="text" 
              class="input-player-carnet" 
              placeholder="Ej. 8765432 LP" 
              value="${escapeHtml(player.carnet)}" 
              required
            >
          </div>
        </div>
      </div>

      <!-- Botón Eliminar -->
      <button type="button" class="btn-remove-player" title="Eliminar Jugador" data-remove-id="${player.id}">
        🗑️
      </button>
    `;

    // Conectar eventos de la tarjeta
    const previewBox = card.querySelector(`#previewBox_${player.id}`);
    const fileInput = card.querySelector(`#fileInput_${player.id}`);
    const nameInput = card.querySelector('.input-player-name');
    const carnetInput = card.querySelector('.input-player-carnet');
    const btnRemove = card.querySelector('.btn-remove-player');

    // Clic en preview abre file input
    previewBox.addEventListener('click', () => fileInput.click());

    // Cambio en archivo de foto con compresión
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const compressedBlob = await compressImage(file, 1200, 0.85);
        if (player.photoPreviewUrl) {
          URL.revokeObjectURL(player.photoPreviewUrl);
        }
        player.photoBlob = compressedBlob;
        player.photoPreviewUrl = URL.createObjectURL(compressedBlob);
        
        // Actualizar preview en DOM sin perder focos de texto
        previewBox.classList.add('has-photo');
        previewBox.innerHTML = `<img src="${player.photoPreviewUrl}" alt="Foto de Jugador">`;
      } catch (err) {
        console.error('Error al procesar la imagen:', err);
        showError(['No se pudo procesar la imagen seleccionada. Intenta con otra foto.']);
      }
    });

    // Guardar cambios en inputs
    nameInput.addEventListener('input', (e) => {
      player.name = e.target.value;
    });

    carnetInput.addEventListener('input', (e) => {
      player.carnet = e.target.value;
    });

    // Evento eliminar
    btnRemove.addEventListener('click', () => removePlayer(player.id));

    elements.playersList.appendChild(card);
  });
}

/**
 * Comprime imágenes en el cliente mediante un Canvas HTML5
 * Reduce fotos pesadas de celulares (5MB) a ~150-250KB al instante.
 */
function compressImage(file, maxDimension = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Fallo al comprimir el canvas'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = readerEvent.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Maneja el envío del formulario
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  hideError();

  const clubName = elements.clubNameInput.value.trim();
  const errors = [];

  if (!clubName) {
    errors.push('El nombre del club o equipo es obligatorio.');
  }

  if (state.players.length === 0) {
    errors.push('Debe agregar al menos un jugador en la planilla.');
  }

  state.players.forEach((p, idx) => {
    const num = idx + 1;
    if (!p.name.trim()) {
      errors.push(`Jugador #${num}: Debe ingresar el nombre completo.`);
    }
    if (!p.carnet.trim()) {
      errors.push(`Jugador #${num}: Debe ingresar el número de carnet (CI).`);
    }
    if (!p.photoBlob) {
      errors.push(`Jugador #${num}: Falta cargar la foto.`);
    }
  });

  if (errors.length > 0) {
    showError(errors);
    return;
  }

  // Preparar FormData para envío multipart
  const formData = new FormData();
  formData.append('clubName', clubName);

  const playersMeta = state.players.map((p, idx) => ({
    name: p.name.trim(),
    carnet: p.carnet.trim(),
    photoIndex: idx
  }));

  formData.append('players', JSON.stringify(playersMeta));

  state.players.forEach((p, idx) => {
    const safeFilename = `${p.carnet.trim()}_${p.name.trim().replace(/\s+/g, '_')}.jpg`;
    formData.append(`photo_${idx}`, p.photoBlob, safeFilename);
  });

  // Mostrar modal de carga
  elements.loadingModal.classList.remove('hidden');
  elements.btnSubmit.disabled = true;

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    elements.loadingModal.classList.add('hidden');
    elements.btnSubmit.disabled = false;

    if (!response.ok || !result.success) {
      const errorList = result.errors || [result.error || 'Error al procesar la inscripción'];
      showError(errorList);
      return;
    }

    // Mostrar modal de éxito
    showSuccess(clubName, state.players, result.data);

  } catch (err) {
    console.error('Error de red al enviar:', err);
    elements.loadingModal.classList.add('hidden');
    elements.btnSubmit.disabled = false;
    showError(['Ocurrió un error de conexión con el servidor. Por favor, verifica tu red e intenta de nuevo.']);
  }
}

/**
 * Muestra el modal de confirmación y resumen
 */
function showSuccess(clubName, players, serverData) {
  elements.summaryClubName.textContent = `🛡️ Club: ${clubName}`;
  elements.summaryPlayersList.innerHTML = '';

  players.forEach((p, idx) => {
    const div = document.createElement('div');
    div.className = 'summary-item';
    div.innerHTML = `
      <img src="${p.photoPreviewUrl}" alt="Foto" class="summary-thumb">
      <div>
        <strong>#${idx + 1} - ${escapeHtml(p.name)}</strong><br>
        <small style="color: #94a3b8;">CI: ${escapeHtml(p.carnet)}</small>
      </div>
    `;
    elements.summaryPlayersList.appendChild(div);
  });

  elements.successModal.classList.remove('hidden');
}

/**
 * Reinicia el formulario para un nuevo registro
 */
function resetForm() {
  elements.successModal.classList.add('hidden');
  elements.form.reset();
  
  // Limpiar URLs de blobs
  state.players.forEach(p => {
    if (p.photoPreviewUrl) URL.revokeObjectURL(p.photoPreviewUrl);
  });

  state.players = [];
  state.nextId = 1;
  hideError();

  for (let i = 0; i < 5; i++) {
    addPlayer();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Utilidades para errores y escape de HTML
 */
function showError(errors) {
  elements.formErrors.innerHTML = `
    <strong>Por favor corrige los siguientes puntos:</strong>
    <ul style="margin-top: 0.5rem; margin-left: 1.25rem;">
      ${errors.map(err => `<li>${escapeHtml(err)}</li>`).join('')}
    </ul>
  `;
  elements.formErrors.classList.remove('hidden');
  elements.formErrors.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
  elements.formErrors.classList.add('hidden');
  elements.formErrors.innerHTML = '';
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
