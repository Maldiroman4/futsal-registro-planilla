# ⚽ Sistema de Registro de Futsal y Planilla en Google Drive

Aplicación web completa, moderna y ligera diseñada para que los capitanes de clubes de futsal inscriban a su equipo ingresando el **nombre del club**, la nómina de jugadores con **nombre completo**, **número de carnet (CI)** y **fotografía individual**.

Las fotografías se suben automáticamente a tu **Google Drive** (organizadas en carpetas por club) y los datos se registran en una **Planilla de Google Sheets** en tiempo real, con vista previa de imagen mediante fórmula `=IMAGE()`.

---

## 🚀 Características Principales

- **📱 Formulario Móvil y de Escritorio:** Diseñado para capitanes desde el celular o computadora.
- **📷 Captura y Subida de Fotos:** Permite tomar foto directamente con la cámara del celular o seleccionar archivo, con compresión automática en el navegador (reduce fotos de 5MB a ~200KB en milisegundos).
- **🛡️ Organización en Google Drive:** Crea automáticamente una subcarpeta con el nombre del club dentro de tu carpeta principal y sube las fotos nombradas como `[CI]_[Nombre].jpg`.
- **📊 Planilla en Vivo en Google Sheets:** Cada registro inserta filas con marca temporal, club, datos del jugador, enlace a Drive y miniatura de la foto.
- **⚡ Despliegue en 1 Clic:** Listo para desplegar en servicios gratuitos como **Render**, **Railway** o cualquier VPS con Docker.
- **🔄 Modo Local / Fallback:** Si aún no has vinculado tus credenciales de Google, la aplicación funciona de inmediato guardando las fotos en `public/uploads/` para que puedas probarla sin esperas.

---

## 🛠️ Requisitos Previos

- **Node.js** (v18 o superior) y **npm**.
- (Opcional para producción) Cuenta de **Google Cloud** con Drive API y Sheets API habilitadas.

---

## 🏁 Inicio Rápido Local

1. Clona o abre esta carpeta en tu terminal:
   ```bash
   cd futsal-registro-planilla
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Inicia el servidor:
   ```bash
   npm start
   ```

4. Abre en tu navegador:
   ```
   http://localhost:3000
   ```

---

## ☁️ Conexión con tu Google Drive y Google Sheets

Para que los datos se guarden directamente en tu cuenta de Google Drive:

### Paso 1: Crear Service Account en Google Cloud (Gratuito)
1. Ingresa a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto nuevo (ej. `Campeonato Futsal`).
3. En el menú lateral, ve a **APIs y servicios > Biblioteca** y habilita dos APIs:
   - **Google Drive API**
   - **Google Sheets API**
4. Ve a **APIs y servicios > Credenciales > Crear credenciales > Cuenta de servicio**.
5. Ponle un nombre (ej. `futsal-bot`), presiona Continuar y Finalizar.
6. Haz clic sobre la cuenta de servicio creada, entra a la pestaña **Claves (Keys) > Agregar clave > Crear clave nueva > JSON**. Se descargará un archivo `.json` con tus credenciales.

### Paso 2: Crear tu Carpeta y tu Planilla en Google Drive
1. En tu [Google Drive](https://drive.google.com/), crea una carpeta para el torneo (ej. `Fotos Futsal 2026`).
2. Abre la carpeta y copia el **ID de la carpeta** desde la URL en tu navegador:
   `https://drive.google.com/drive/folders/ESTE_ES_EL_ID_DE_CARPETA`
3. Crea una hoja de cálculo en blanco en [Google Sheets](https://sheets.new) (ej. `Planilla Oficial Futsal`).
4. Copia el **ID de la hoja de cálculo** desde la URL:
   `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID_DEL_SHEET/edit`
5. **¡Muy Importante!** Comparte tanto la **Carpeta de Drive** como la **Hoja de Google Sheets** con el email de tu cuenta de servicio (ej: `futsal-bot@tu-proyecto.iam.gserviceaccount.com`) dándole permisos de **Editor**.

### Paso 3: Configurar el archivo `.env`
Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```
Y añade tus variables:
```env
PORT=3000
DRIVE_FOLDER_ID=tu_id_de_carpeta_aqui
SPREADSHEET_ID=tu_id_de_sheet_aqui
GOOGLE_CLIENT_EMAIL=futsal-bot@tu-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu_clave_privada_completa\n-----END PRIVATE KEY-----\n"
```
*(También puedes colocar el archivo descargado de Google como `credentials.json` en la raíz del proyecto).*

---

## 🌐 Despliegue en la Nube (Gratis)

### Opción 1: Desplegar en Render (Recomendado)
1. Sube este proyecto a tu repositorio de **GitHub**.
2. Ingresa a [Render.com](https://render.com/) y crea una cuenta gratuita.
3. Haz clic en **New + > Web Service** y selecciona tu repositorio.
4. Render detectará automáticamente `render.yaml` o configura:
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. En la sección **Environment Variables**, agrega:
   - `DRIVE_FOLDER_ID`: Tu ID de carpeta en Drive.
   - `SPREADSHEET_ID`: Tu ID de Google Sheet.
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: Todo el contenido del archivo JSON de Google en una sola línea.
6. Haz clic en **Deploy Web Service**. ¡Listo! Tendrás una URL pública (ej. `https://tu-torneo.onrender.com`) para enviar por WhatsApp a los capitanes.

### Opción 2: Desplegar con Docker
```bash
docker build -t futsal-planilla .
docker run -p 3000:3000 --env-file .env futsal-planilla
```

---

## 🧪 Pruebas Automatizadas

Para correr la suite de pruebas del servidor:
```bash
npm test
```
