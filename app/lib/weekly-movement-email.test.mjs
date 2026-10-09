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

test('renders a generator-by-date grid with movement details in the matching cell', () => {
  const secondGenerator = { ...generator, id: 'g-2', codigo: 'G-202', ubicacion: 'Taller' };
  const email = buildWeeklyMovementEmail(
    [movement],
    [generator, secondGenerator],
    new Date('2026-10-09T10:00:00Z'),
  );

  assert.ok(email.html.indexOf('Calendario semanal de movimientos') < email.html.indexOf('Resumen semanal'));
  assert.ok(email.text.indexOf('Calendario semanal de movimientos') < email.text.indexOf('Resumen semanal'));
  assert.equal((email.html.match(/<th scope="col"/g) ?? []).length, 8);
  assert.equal((email.html.match(/class="generator-row"/g) ?? []).length, 2);
  assert.equal((email.html.match(/data-calendar-cell=/g) ?? []).length, 14);

  const fridayCell = getCalendarCell(email.html, 'g-1:2026-10-09');
  assert.ok(email.html.includes('G-101 · Volvo 440'));
  for (const detail of [
    'Movimiento m-1',
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
  assert.ok(fridayCell.includes('style="color: #9a6700;">Almacén → Obra norte'));
  assert.ok(getCalendarCell(email.html, 'g-1:2026-10-05').includes('Ubicación: Almacén'));
  assert.ok(getCalendarCell(email.html, 'g-2:2026-10-09').includes('Ubicación: Taller'));
  assert.ok(email.text.includes('Viernes, 09 de octubre de 2026'));
  assert.ok(email.html.includes('Movimientos:</strong> 1'));
  assert.ok(email.html.includes('Pendientes:</strong> 1'));
  assert.ok(email.html.includes('Completados:</strong> 0'));
  const detailsHeading = email.html.indexOf('<h2>Detalle de movimientos</h2>');
  assert.ok(detailsHeading > email.html.indexOf('Completados:</strong> 0'));
  const emailDetails = email.html.slice(detailsHeading);
  for (const detail of [
    'Fecha', 'Generador', 'Origen', 'Hora de recogida', 'Destino',
    'Hora de entrega', 'Transporte', 'Notas / comentarios', 'Estado',
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

  assert.ok(fridayCell.indexOf('Movimiento m-1') < fridayCell.indexOf('Movimiento m-2'));
  assert.ok(fridayCell.includes('Local'));
  assert.ok(fridayCell.includes('Nacex'));
  assert.ok(fridayCell.includes('Confirmar recepción'));
  assert.ok(email.text.includes('Movimiento m-1'));
  assert.ok(email.text.includes('Movimiento m-2'));
  assert.ok(email.html.includes('Movimientos:</strong> 2'));
});

test('shows generator locations in empty-week cells and a useful zero-count summary', () => {
  const email = buildWeeklyMovementEmail([], [generator], new Date('2026-10-09T10:00:00Z'));

  assert.equal((email.html.match(/data-calendar-cell=/g) ?? []).length, 7);
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
  assert.ok(email.html.includes('Movimiento m-&lt;1&gt;'));
  assert.ok(email.html.includes('&lt;Almacén&gt; → Obra norte'));
  assert.ok(email.html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;'));
  assert.ok(email.html.includes('Avisar a &lt;operaciones&gt;'));
  assert.doesNotMatch(email.html, /<script>|<operaciones>/);
  assert.match(email.html, /word-break: break-word/);
});
