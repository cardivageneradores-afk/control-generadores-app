import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyMovementEmail } from './weekly-movement-email.ts';

const generator = {
  id: 'g-1',
  codigo: 'G-101',
  modelo: 'Volvo 440',
  ubicacion: 'Almacén',
  estado: 'estable',
};

const movement = {
  id: 'm-1',
  generador_id: 'g-1',
  fecha: '2026-10-09',
  origen: 'Almacén',
  destino: 'Obra norte',
  tipo_transporte: 'Local',
  hora_recogida: '08:30:00',
  hora_entrega: '10:15:00',
  notas: 'Llamar antes de llegar',
  estado: 'pendiente',
};

function getCalendarCell(html, key) {
  const markerIndex = html.indexOf(`data-calendar-cell="${key}"`);
  assert.notEqual(markerIndex, -1, `calendar cell ${key} should exist`);
  const openingIndex = html.lastIndexOf('<td', markerIndex);
  const cellTags = /<\/?td\b[^>]*>/gi;
  cellTags.lastIndex = openingIndex;
  let depth = 0;
  let match;
  while ((match = cellTags.exec(html))) {
    if (/^<td\b/i.test(match[0])) {
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(openingIndex, cellTags.lastIndex);
    }
  }
  assert.fail(`calendar cell ${key} should have a closing tag`);
}

function getMovementCard(cell, detail) {
  const detailIndex = cell.indexOf(detail);
  assert.notEqual(detailIndex, -1, `movement detail ${detail} should exist in the calendar cell`);
  const cardStart = cell.lastIndexOf('<table', detailIndex);
  const cardEnd = cell.indexOf('</table>', detailIndex) + '</table>'.length;
  return cell.slice(cardStart, cardEnd);
}

test('renders a generator-by-date grid with movement details in the matching cell', () => {
  const secondGenerator = { ...generator, id: 'g-2', codigo: 'G-202', ubicacion: 'Taller' };
  const email = buildWeeklyMovementEmail(
    [movement],
    [generator, secondGenerator],
    new Date('2026-10-09T10:00:00Z'),
    { logoCid: 'cardiva-logo' },
  );

  assert.ok(email.html.indexOf('Calendario semanal de movimientos') < email.html.indexOf('Resumen semanal'));
  assert.ok(email.text.indexOf('Calendario semanal de movimientos') < email.text.indexOf('Resumen semanal'));
  assert.match(email.html, /<img src="cid:cardiva-logo" alt="Cardiva Generadores"/);
  assert.ok(!email.text.includes('cardiva-logo.png'));
  assert.equal((email.html.match(/<th scope="col"/g) ?? []).length, 8);
  assert.equal((email.html.match(/class="generator-row"/g) ?? []).length, 2);
  assert.equal((email.html.match(/data-calendar-cell=/g) ?? []).length, 14);

  const fridayCell = getCalendarCell(email.html, 'g-1:2026-10-09');
  assert.ok(email.html.includes('G-101 · Volvo 440'));
  for (const detail of [
    'Almacén → Obra norte',
    'Local',
    'Recogida: 08:30',
    'Entrega: 10:15',
    'Estado: pendiente',
    'Comentarios: ',
    'Llamar antes de llegar',
  ]) {
    assert.ok(fridayCell.includes(detail), `matching cell should include ${detail}`);
    assert.ok(email.text.includes(detail), `plain text should include ${detail}`);
  }
  assert.ok(!fridayCell.includes(movement.id));
  assert.ok(!email.html.includes(movement.id));
  assert.ok(!email.text.includes(movement.id));
  assert.ok(fridayCell.includes('style="color: #9a6700;">Almacén → Obra norte'));
  assert.ok(getCalendarCell(email.html, 'g-1:2026-10-05').includes('Ubicación: Almacén'));
  assert.ok(getCalendarCell(email.html, 'g-2:2026-10-09').includes('Ubicación: Taller'));
  assert.ok(email.text.includes('Viernes, 09 de octubre de 2026'));
  assert.ok(email.html.includes('Movimientos:</strong> 1'));
  assert.ok(email.html.includes('Pendientes:</strong> 1'));
  assert.ok(email.html.includes('Completados:</strong> 0'));
  assert.equal(email.subjectDateRange, '5-11 oct 2026');
  const detailsHeading = email.html.indexOf('<h2>Detalle de movimientos</h2>');
  assert.ok(detailsHeading > email.html.indexOf('Calendario semanal por generador'));
  const weeklySummaryHeading = email.html.indexOf('>Resumen semanal</h2>');
  assert.ok(weeklySummaryHeading > detailsHeading);
  assert.ok(email.text.indexOf('Detalle de movimientos') < email.text.indexOf('Resumen semanal'));
  const emailDetails = email.html.slice(detailsHeading);
  for (const detail of [
    'Origen', 'Destino', 'Recogida', 'Entrega', 'Transporte',
    'Notas / comentarios', 'Estado', 'Registrado por', 'Creado',
  ]) {
    assert.ok(emailDetails.includes(detail), `detailed email summary should include ${detail}`);
  }
  const textDetails = email.text.slice(email.text.indexOf('Detalle de movimientos'));
  assert.ok(textDetails.length > 0);
  for (const detail of [
    'Fecha:', 'Generador:', 'Origen:', 'Hora de recogida:', 'Destino:',
    'Hora de entrega:', 'Transporte:', 'Notas / comentarios:', 'Estado:',
  ]) {
    assert.ok(textDetails.includes(detail), `plain-text email summary should include ${detail}`);
  }
  assert.ok(textDetails.includes('Registrado por: —'));
  assert.doesNotMatch(email.html, /display:\s*(grid|flex)/i);
});

test('keeps multiple same-day movements legible in one generator cell', () => {
  const laterMovement = {
    ...movement,
    id: 'm-2',
    origen: 'Obra norte',
    destino: 'Almacén',
    tipo_transporte: 'Nacex',
    hora_recogida: '14:00:00',
    hora_entrega: '16:30:00',
    notas: 'Confirmar recepción',
    estado: 'completado',
  };
  const email = buildWeeklyMovementEmail(
    [laterMovement, movement],
    [generator],
    new Date('2026-10-09T10:00:00Z'),
  );
  const fridayCell = getCalendarCell(email.html, 'g-1:2026-10-09');

  assert.ok(fridayCell.indexOf('Almacén → Obra norte') < fridayCell.indexOf('Obra norte → Almacén'));
  assert.ok(fridayCell.includes('Local'));
  assert.ok(fridayCell.includes('Nacex'));
  assert.ok(fridayCell.includes('Confirmar recepción'));
  assert.ok(!email.html.includes(laterMovement.id));
  assert.ok(!email.text.includes(laterMovement.id));
  assert.ok(!email.html.includes(movement.id));
  assert.ok(!email.text.includes(movement.id));
  assert.ok(email.html.includes('Movimientos:</strong> 2'));
});

test('keeps technical movement IDs and movement-title lines out of both email formats', () => {
  const movementId = 'm-1791559236349';
  const email = buildWeeklyMovementEmail(
    [{ ...movement, id: movementId }],
    [generator],
    new Date('2026-10-09T10:00:00Z'),
  );

  assert.doesNotMatch(email.html, new RegExp(movementId));
  assert.doesNotMatch(email.text, new RegExp(movementId));
  assert.doesNotMatch(email.html, /Movimiento m-1791559236349/);
  assert.doesNotMatch(email.text, /Movimiento m-1791559236349/);
});

test('shows generator locations in empty-week cells and a useful zero-count summary', () => {
  const email = buildWeeklyMovementEmail([], [generator], new Date('2026-10-09T10:00:00Z'));

  assert.equal((email.html.match(/data-calendar-cell=/g) ?? []).length, 7);
  assert.doesNotMatch(email.html, /cardiva-logo\.png/);
  assert.equal((email.html.match(/Ubicación: Almacén/g) ?? []).length, 7);
  assert.equal((email.text.match(/Ubicación: Almacén/g) ?? []).length, 7);
  assert.ok(email.html.indexOf('Calendario semanal de movimientos') < email.html.indexOf('Resumen semanal'));
  assert.ok(email.html.includes('No hay movimientos esta semana.'));
  assert.ok(email.text.includes('No hay movimientos esta semana.'));
  for (const [detail, htmlDetail] of [
    ['Movimientos: 0', '<strong>Movimientos:</strong> 0'],
    ['Pendientes: 0', '<strong>Pendientes:</strong> 0'],
    ['Completados: 0', '<strong>Completados:</strong> 0'],
  ]) {
    assert.ok(email.text.includes(detail));
    assert.ok(email.html.includes(htmlDetail));
  }
});

test('highlights edited movements but leaves new movements unmarked and identifies the sender', () => {
  const edited = { ...movement, editado_en: '2026-10-09T10:30:00.000Z' };
  const email = buildWeeklyMovementEmail(
    [edited, { ...movement, id: 'm-new', destino: 'Obra sur' }],
    [generator],
    new Date('2026-10-09T10:00:00Z'),
    { sender: { nombre: 'Ana <Admin>', email: 'ana@example.com' } },
  );
  const fridayCell = getCalendarCell(email.html, 'g-1:2026-10-09');
  const editedMovement = getMovementCard(fridayCell, 'Almacén → Obra norte');
  const newMovement = getMovementCard(fridayCell, 'Almacén → Obra sur');

  assert.match(editedMovement, /aria-label="Movimiento editado"/);
  assert.match(editedMovement, />EDITADO</);
  assert.match(editedMovement, /border: 2px solid #c2410c/);
  assert.doesNotMatch(newMovement, /aria-label="Movimiento editado"/);
  assert.match(email.html, /Enviado por: <strong>Ana &lt;Admin&gt;<\/strong> \(ana@example\.com\)/);
  assert.ok(email.text.includes('Enviado por: Ana <Admin> (ana@example.com)'));
  assert.match(email.text, /\[MOVIMIENTO EDITADO\]/);
  assert.ok(email.html.includes('aria-label="Movimiento editado"'));
  assert.ok(!email.html.includes(edited.id));
  assert.ok(!email.text.includes(edited.id));
  assert.ok(!email.html.includes('m-new'));
  assert.ok(!email.text.includes('m-new'));

  const nextWeekEmail = buildWeeklyMovementEmail(
    [
      { ...edited, fecha: '2026-10-16' },
      { ...movement, id: 'm-created-next-week', fecha: '2026-10-16' },
    ],
    [generator],
    new Date('2026-10-16T10:00:00Z'),
  );
  assert.equal((nextWeekEmail.html.match(/aria-label="Movimiento editado"/g) ?? []).length, 2);
  assert.equal((nextWeekEmail.html.match(/>EDITADO</g) ?? []).length, 1);
  assert.equal(nextWeekEmail.subjectDateRange, '12-18 oct 2026');
  assert.equal((nextWeekEmail.text.match(/\[MOVIMIENTO EDITADO\]/g) ?? []).length, 2);
  assert.doesNotMatch(nextWeekEmail.html, /m-1/);
  assert.doesNotMatch(nextWeekEmail.text, /m-1/);
  assert.doesNotMatch(nextWeekEmail.html, /m-created-next-week/);
  assert.doesNotMatch(nextWeekEmail.text, /m-created-next-week/);
});

test('escapes dynamic HTML values and preserves readable plain text and long comments', () => {
  const longComment = `${'<script>alert("x")</script>& '.repeat(30)}\nAvisar a <operaciones>`;
  const email = buildWeeklyMovementEmail(
    [{ ...movement, id: 'm-<1>', notas: longComment, origen: '<Almacén>' }],
    [{ ...generator, codigo: 'G<&"101' }],
    new Date('2026-10-09T10:00:00Z'),
  );

  assert.ok(email.text.includes(longComment));
  assert.ok(email.text.includes('<Almacén> → Obra norte'));
  assert.ok(email.html.includes('G&lt;&amp;&quot;101'));
  assert.ok(!email.text.includes('m-<1>'));
  assert.ok(!email.html.includes('m-&lt;1&gt;'));
  assert.ok(email.html.includes('&lt;Almacén&gt; → Obra norte'));
  assert.ok(email.html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;'));
  assert.ok(email.html.includes('Avisar a &lt;operaciones&gt;'));
  assert.doesNotMatch(email.html, /<script>|<operaciones>/);
  assert.match(email.html, /word-break: normal/);
  assert.match(email.html, /overflow-wrap: break-word/);
});

test('formats the subject date range compactly across month and year boundaries', () => {
  const sameMonth = buildWeeklyMovementEmail([], [generator], new Date('2026-10-14T10:00:00Z'));
  const crossMonth = buildWeeklyMovementEmail([], [generator], new Date('2025-10-01T10:00:00Z'));
  const crossYear = buildWeeklyMovementEmail([], [generator], new Date('2025-12-31T10:00:00Z'));

  assert.equal(sameMonth.subjectDateRange, '12-18 oct 2026');
  assert.equal(crossMonth.subjectDateRange, '29 sep - 5 oct 2025');
  assert.equal(crossYear.subjectDateRange, '29 dic 2025 - 4 ene 2026');
});

test('uses compact inline table styles for a readable movement card', () => {
  const email = buildWeeklyMovementEmail(
    [{ ...movement, notas: 'A nombre completo con comentario largo para comprobar el ajuste entre palabras.', editado_en: '2026-10-09T10:30:00.000Z' }],
    [generator],
    new Date('2026-10-09T10:00:00Z'),
  );
  const cell = getCalendarCell(email.html, 'g-1:2026-10-09');
  const card = getMovementCard(cell, 'Almacén → Obra norte');

  assert.match(email.html, /table-layout: fixed/);
  assert.match(email.html, /<th scope="col" width="10%"/);
  assert.match(email.html, /<td data-calendar-cell="g-1:2026-10-09" width="12\.85%"/);
  assert.match(card, /font-size: 9px/);
  assert.match(card, /padding: 4px/);
  assert.match(card, /white-space: nowrap;">EDITADO/);
  assert.match(card, /Recogida: 08:30 · Entrega: 10:15 · Estado: pendiente/);
  assert.match(card, /Comentarios: <span[^>]*>A nombre completo con comentario largo para comprobar el ajuste entre palabras\.<\/span>/);
  assert.match(getCalendarCell(email.html, 'g-1:2026-10-05'), /font-size: 10px; color: #4b5563/);
});

test('orders separated detail cards by date and time with matching fixed-width detail columns', () => {
  const movements = [
    {
      ...movement,
      id: 'm-early',
      fecha: '2026-10-15',
      hora_recogida: '08:00:00',
      destino: 'Destino temprano',
      usuario: 'Ana',
      creado_en: '2026-10-14T08:00:00.000Z',
    },
    {
      ...movement,
      id: 'm-latest',
      fecha: '2026-10-16',
      hora_recogida: '15:30:00',
      destino: 'Destino último',
      estado: 'completado',
      usuario: 'Berta',
      creado_en: '2026-10-16T08:00:00.000Z',
      completado_en: '2026-10-16T14:00:00.000Z',
      editado_en: '2026-10-16T15:00:00.000Z',
      notas: 'Comentario completo del movimiento reciente',
    },
    {
      ...movement,
      id: 'm-middle',
      fecha: '2026-10-15',
      hora_recogida: '12:00:00',
      destino: 'Destino mediodía',
    },
  ];
  const email = buildWeeklyMovementEmail(
    movements,
    [generator],
    new Date('2026-10-16T10:00:00Z'),
  );
  const details = email.html.slice(email.html.indexOf('<h2>Detalle de movimientos</h2>'));
  const latestIndex = details.indexOf('16 oct 2026 · G-101 · Volvo 440');
  const middleIndex = details.indexOf('Destino mediodía');
  const earlyIndex = details.indexOf('Destino temprano');

  assert.ok(latestIndex >= 0 && latestIndex < middleIndex && middleIndex < earlyIndex);
  assert.equal((details.match(/height="16"/g) ?? []).length, 2);
  assert.equal((details.match(/<col width="15%"/g) ?? []).length, 6);
  assert.equal((details.match(/<col width="35%"/g) ?? []).length, 6);
  assert.match(details, /MOVIMIENTO EDITADO/);
  for (const detail of [
    'Origen', 'Almacén', 'Destino último', 'Recogida', '08:00', 'Entrega', '10:15',
    'Transporte', 'Local', 'Estado', 'completado', 'Registrado por', 'Berta',
    'Creado', 'Completado', 'Notas / comentarios', 'Comentario completo del movimiento reciente',
  ]) {
    assert.ok(details.includes(detail), `detail cards should include ${detail}`);
  }
  assert.match(details, /Completado<\/td>[\s\S]*?16\/10\/2026/);
  assert.doesNotMatch(
    details.slice(details.indexOf('15 oct 2026 · G-101 · Volvo 440')),
    /Completado<\/td>/,
  );
});
