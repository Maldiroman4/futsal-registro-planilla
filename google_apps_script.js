/**
 * CÓDIGO PARA GOOGLE APPS SCRIPT
 * Pega este código en tu Google Sheet: Menú Extensiones > Apps Script
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var mainFolder = DriveApp.getFolderById(data.folderId);
    
    // Buscar o crear la subcarpeta del Club
    var clubFolder;
    var folders = mainFolder.getFoldersByName(data.clubName);
    if (folders.hasNext()) {
      clubFolder = folders.next();
    } else {
      clubFolder = mainFolder.createFolder(data.clubName);
    }

    // Decodificar la imagen en base64 y guardarla
    var decoded = Utilities.base64Decode(data.base64);
    var blob = Utilities.newBlob(decoded, data.mimeType || 'image/jpeg', data.filename);
    var file = clubFolder.createFile(blob);
    
    // Permitir lectura con el enlace para la fórmula =IMAGE()
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: file.getId(),
      viewUrl: file.getUrl(),
      directImageUrl: "https://drive.google.com/uc?export=view&id=" + file.getId()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
