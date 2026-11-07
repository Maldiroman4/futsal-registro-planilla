const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

/**
 * Servicio para interactuar con Google Drive y Google Sheets
 */
class GoogleService {
  constructor() {
    this.drive = null;
    this.sheets = null;
    this.isConfigured = false;
    this.rootFolderId = process.env.DRIVE_FOLDER_ID || null;
    this.spreadsheetId = process.env.SPREADSHEET_ID || null;
    this.driveScriptUrl = process.env.DRIVE_UPLOAD_SCRIPT_URL || null;
    this.init();
  }

  init() {
    try {
      let authClient = null;

      // 1. Prioridad: JSON completo en variable de entorno (ideal para Render/Railway)
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        let keyData;
        try {
          keyData = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        } catch {
          // Si vino codificado en base64
          const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8');
          keyData = JSON.parse(decoded);
        }
        authClient = new google.auth.JWT(
          keyData.client_email,
          null,
          keyData.private_key,
          [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets'
          ]
        );
      }
      // 2. Variables de entorno separadas
      else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        authClient = new google.auth.JWT(
          process.env.GOOGLE_CLIENT_EMAIL,
          null,
          privateKey,
          [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets'
          ]
        );
      }
      // 3. Archivo credentials.json local
      else {
        const credentialsPath = path.join(__dirname, '..', 'credentials.json');
        if (fs.existsSync(credentialsPath)) {
          const keyData = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
          authClient = new google.auth.JWT(
            keyData.client_email,
            null,
            keyData.private_key,
            [
              'https://www.googleapis.com/auth/drive',
              'https://www.googleapis.com/auth/spreadsheets'
            ]
          );
        }
      }

      if (authClient) {
        this.drive = google.drive({ version: 'v3', auth: authClient });
        this.sheets = google.sheets({ version: 'v4', auth: authClient });
        this.isConfigured = true;
        console.log('✓ Google Service Account autenticado correctamente.');
      } else {
        console.log('ℹ Modo Local / Demo activo: No se detectaron credenciales de Google Cloud.');
        console.log('  Las fotos se guardarán en public/uploads/ y los datos en data/local_submissions.json');
      }
    } catch (err) {
      console.warn('⚠ Advertencia al inicializar Google Service:', err.message);
      this.isConfigured = false;
    }
  }

  /**
   * Verifica el estado del servicio
   */
  getStatus() {
    return {
      configured: this.isConfigured,
      hasDriveFolder: Boolean(this.rootFolderId),
      hasSpreadsheet: Boolean(this.spreadsheetId),
      hasDriveScript: Boolean(this.driveScriptUrl),
      mode: this.isConfigured && this.rootFolderId && this.spreadsheetId ? 'google_cloud' : 'local_fallback'
    };
  }

  /**
   * Crea o busca una subcarpeta en Google Drive para el Club
   */
  async getOrCreateClubFolder(clubName) {
    if (!this.isConfigured || !this.rootFolderId) {
      return null;
    }

    const safeClubName = clubName.replace(/'/g, "\\'");
    const query = `mimeType='application/vnd.google-apps.folder' and name='${safeClubName}' and '${this.rootFolderId}' in parents and trashed=false`;

    const res = await this.drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id;
    }

    // Crear la carpeta si no existe
    const folderMetadata = {
      name: clubName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [this.rootFolderId]
    };

    const folder = await this.drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });

    return folder.data.id;
  }

  /**
   * Sube una foto a Google Drive (o guarda local si no hay credenciales)
   */
  async uploadPhoto(clubName, player, clubFolderId) {
    const safeClub = clubName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const safeName = player.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const safeCarnet = player.carnet.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `${safeCarnet}_${safeName}.jpg`;

    // 1. Si se configuró el puente Apps Script (escribe con la cuota personal de Google Drive del usuario)
    if (this.driveScriptUrl) {
      try {
        const base64 = player.photoBuffer.toString('base64');
        const payload = {
          folderId: this.rootFolderId,
          clubName: clubName,
          filename: filename,
          mimeType: player.mimetype || 'image/jpeg',
          base64: base64
        };

        const res = await fetch(this.driveScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const json = await res.json();
          if (json && json.fileId) {
            return {
              fileId: json.fileId,
              filename: filename,
              viewUrl: json.viewUrl || `https://drive.google.com/file/d/${json.fileId}/view`,
              directImageUrl: json.directImageUrl || `https://drive.google.com/uc?export=view&id=${json.fileId}`
            };
          }
        }
      } catch (scriptErr) {
        console.warn('Error al subir con Google Apps Script, intentando alternativa:', scriptErr.message);
      }
    }

    // 2. Intento directo con Service Account (Shared Drives o Service Accounts con cuota)
    if (this.isConfigured && this.rootFolderId && clubFolderId) {
      try {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(player.photoBuffer);

        const fileMetadata = {
          name: filename,
          parents: [clubFolderId]
        };

        const media = {
          mimeType: player.mimetype || 'image/jpeg',
          body: bufferStream
        };

        const driveRes = await this.drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: 'id, name, webViewLink, webContentLink',
          supportsAllDrives: true
        });

        const fileId = driveRes.data.id;

        try {
          await this.drive.permissions.create({
            fileId: fileId,
            requestBody: { role: 'reader', type: 'anyone' }
          });
        } catch {}

        const viewUrl = driveRes.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
        const directImageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

        return {
          fileId,
          filename,
          viewUrl,
          directImageUrl
        };
      } catch (driveErr) {
        console.warn('Nota sobre subida directa de foto a Drive:', driveErr.message);
      }
    }

    // 3. Fallback Local (guarda en disco y permite continuar sin perder datos)
    const localDir = path.join(__dirname, '..', 'public', 'uploads', safeClub);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const localPath = path.join(localDir, filename);
    fs.writeFileSync(localPath, player.photoBuffer);

    const relativeUrl = `/uploads/${safeClub}/${filename}`;
    return {
      fileId: `local_${Date.now()}_${safeCarnet}`,
      filename,
      viewUrl: relativeUrl,
      directImageUrl: relativeUrl
    };
  }

  /**
   * Asegura que la hoja de Google Sheets tenga encabezados
   */
  async ensureSheetHeaders() {
    if (!this.isConfigured || !this.spreadsheetId) return;

    try {
      const check = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A1:G1'
      });

      if (!check.data.values || check.data.values.length === 0) {
        const headers = [
          ['Fecha y Hora', 'Nombre del Club', 'Nombre del Jugador', 'Carnet (CI)', 'ID Archivo Drive', 'Enlace de Foto', 'Vista Previa']
        ];
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'A1:G1',
          valueInputOption: 'USER_ENTERED',
          resource: { values: headers }
        });
      }
    } catch (err) {
      console.warn('No se pudo verificar cabecera de Sheets:', err.message);
    }
  }

  /**
   * Guarda los registros en Google Sheets (o fallback en local_submissions.json)
   */
  async saveToSheet(clubName, registeredPlayers) {
    const timestamp = new Date().toLocaleString('es-BO', {
      timeZone: 'America/La_Paz',
      dateStyle: 'short',
      timeStyle: 'medium'
    });

    if (this.isConfigured && this.spreadsheetId) {
      await this.ensureSheetHeaders();

      const rows = registeredPlayers.map(p => [
        timestamp,
        clubName,
        p.name,
        p.carnet,
        p.fileId,
        p.viewUrl,
        `=IMAGE("${p.directImageUrl}")`
      ]);

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'A:G',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: rows }
      });

      return { success: true, rowsCount: rows.length };
    }

    // Fallback Local
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const localFile = path.join(dataDir, 'local_submissions.json');
    let existing = [];
    if (fs.existsSync(localFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(localFile, 'utf8'));
      } catch {
        existing = [];
      }
    }

    const newEntries = registeredPlayers.map(p => ({
      timestamp,
      clubName,
      name: p.name,
      carnet: p.carnet,
      fileId: p.fileId,
      viewUrl: p.viewUrl,
      directImageUrl: p.directImageUrl
    }));

    existing.push(...newEntries);
    fs.writeFileSync(localFile, JSON.stringify(existing, null, 2), 'utf8');

    return { success: true, rowsCount: newEntries.length, localFallback: true };
  }

  /**
   * Procesa la inscripción completa de un equipo
   */
  async processClubRegistration(clubName, players) {
    let clubFolderId = null;
    if (this.isConfigured && this.rootFolderId) {
      clubFolderId = await this.getOrCreateClubFolder(clubName);
    }

    const registeredPlayers = [];

    for (const player of players) {
      const uploadRes = await this.uploadPhoto(clubName, player, clubFolderId);
      registeredPlayers.push({
        name: player.name,
        carnet: player.carnet,
        fileId: uploadRes.fileId,
        filename: uploadRes.filename,
        viewUrl: uploadRes.viewUrl,
        directImageUrl: uploadRes.directImageUrl
      });
    }

    const sheetResult = await this.saveToSheet(clubName, registeredPlayers);

    return {
      clubName,
      totalPlayers: registeredPlayers.length,
      players: registeredPlayers,
      storageMode: sheetResult.localFallback ? 'local' : 'google_drive_and_sheets'
    };
  }
}

module.exports = new GoogleService();
