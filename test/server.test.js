const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { validateClubData, sanitizeString } = require('../src/validator');
const app = require('../server');

test('Validador - Sanitización y validaciones básicas', () => {
  assert.strictEqual(sanitizeString('  Club Deportivo   '), 'Club Deportivo');
  assert.strictEqual(sanitizeString(123), '');

  // Club vacío
  const resEmptyClub = validateClubData('', [{ name: 'Juan', carnet: '12345', photoBuffer: Buffer.from('fake') }]);
  assert.strictEqual(resEmptyClub.isValid, false);
  assert.ok(resEmptyClub.errors.some(e => e.includes('nombre del club')));

  // Sin jugadores
  const resNoPlayers = validateClubData('Club Tigres', []);
  assert.strictEqual(resNoPlayers.isValid, false);
  assert.ok(resNoPlayers.errors.some(e => e.includes('al menos un')));

  // Jugador con campos vacíos
  const resBadPlayer = validateClubData('Club Tigres', [
    { name: '', carnet: '', photoBuffer: null }
  ]);
  assert.strictEqual(resBadPlayer.isValid, false);
  assert.strictEqual(resBadPlayer.errors.length, 3); // name, carnet, photo

  // Carnets duplicados
  const resDupCarnet = validateClubData('Club Tigres', [
    { name: 'Juan', carnet: '123456', photoBuffer: Buffer.from('img1') },
    { name: 'Pedro', carnet: '123456', photoBuffer: Buffer.from('img2') }
  ]);
  assert.strictEqual(resDupCarnet.isValid, false);
  assert.ok(resDupCarnet.errors.some(e => e.includes('duplicado')));

  // Datos válidos
  const resValid = validateClubData('Halcones Futsal', [
    { name: 'Carlos Gomez', carnet: '7654321', photoBuffer: Buffer.from('image_bytes_here') }
  ]);
  assert.strictEqual(resValid.isValid, true);
  assert.strictEqual(resValid.errors.length, 0);
  assert.strictEqual(resValid.cleanClubName, 'Halcones Futsal');
});

test('Servidor API - Verificación de endpoints', async (t) => {
  let server;
  let baseUrl;

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  t.after(() => {
    server.close();
  });

  // Test 1: GET /api/health
  await t.test('GET /api/health responde con estado 200 y status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.ok(body.google !== undefined);
  });

  // Test 2: POST /api/register con cuerpo vacío debe retornar 400
  await t.test('POST /api/register sin datos debe fallar con 400', async () => {
    const res = await fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.errors.length > 0);
  });

  // Test 3: POST /api/register con FormData válido
  await t.test('POST /api/register con FormData multipart registra exitosamente', async () => {
    const formData = new FormData();
    formData.append('clubName', 'Futsal Stars');

    const playersMeta = [
      { name: 'Mateo Messi', carnet: '101010' },
      { name: 'Lucas Modric', carnet: '202020' }
    ];
    formData.append('players', JSON.stringify(playersMeta));

    // Adjuntar fotos simuladas
    const fakePhoto1 = new Blob(['fake_png_data_1'], { type: 'image/jpeg' });
    const fakePhoto2 = new Blob(['fake_png_data_2'], { type: 'image/jpeg' });
    formData.append('photo_0', fakePhoto1, 'mateo.jpg');
    formData.append('photo_1', fakePhoto2, 'lucas.jpg');

    const res = await fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      body: formData
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.clubName, 'Futsal Stars');
    assert.strictEqual(body.data.totalPlayers, 2);
    assert.strictEqual(body.data.players[0].name, 'Mateo Messi');
    assert.strictEqual(body.data.players[1].name, 'Lucas Modric');
  });

  // Test 4: GET /api/submissions debe incluir los registros
  await t.test('GET /api/submissions lista las inscripciones registradas', async () => {
    const res = await fetch(`${baseUrl}/api/submissions`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.count >= 2);
    assert.ok(body.submissions.some(s => s.clubName === 'Futsal Stars'));
  });
});
