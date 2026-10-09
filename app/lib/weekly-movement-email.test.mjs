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

test('renders the current week calendar before a concise weekly summary', () => {
  const email = buildWeeklyMovementEmail([movement], [generator], new Date('2026-10-09T10:00:00Z'));

  assert.ok(email.html.indexOf('Calendario semanal de movimientos') < email.html.indexOf('Resumen semanal'));
  assert.ok(email.text.indexOf('Calendario semanal de movimientos') < email.text.indexOf('Resumen semanal'));
  for (const detail of [
    'Viernes, 09 de octubre de 2026',
    'G-101 · Volvo 440',
    'Almacén → Obra norte',
    'Recogida: 08:30 · Entrega: 10:15',
    'Local · pendiente',
    'Comentarios: Llamar antes de llegar',
    'Movimientos: 1',
    'Pendientes: 1',
    'Completados: 0',
  ]) {
    assert.ok(email.text.includes(detail), `plain text should include ${detail}`);
    assert.ok(email.html.includes(detail), `HTML should include ${detail}`);
  }
  assert.match(email.html, /<table[^>]*role="presentation"/);
  assert.doesNotMatch(email.html, /display:\s*(grid|flex)/i);
});

test('escapes dynamic values in HTML and preserves readable text and long comments', () => {
  const longComment = `${'<script>alert("x")</script>& '.repeat(30)}\nAvisar a <operaciones>`;
  const email = buildWeeklyMovementEmail(
    [{ ...movement, notas: longComment }],
    [{ ...generator, codigo: 'G<&"101' }],
    new Date('2026-10-09T10:00:00Z'),
  );

  assert.ok(email.text.includes(longComment));
  assert.ok(email.html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;'));
  assert.ok(email.html.includes('G&lt;&amp;&quot;101'));
  assert.ok(email.html.includes('Avisar a &lt;operaciones&gt;'));
  assert.doesNotMatch(email.html, /<script>|<operaciones>/);
  assert.match(email.html, /word-break: break-word/);
});

test('shows every empty day and a useful zero-count summary for an empty week', () => {
  const email = buildWeeklyMovementEmail([], [], new Date('2026-10-09T10:00:00Z'));

  assert.equal((email.html.match(/>\s*Sin movimientos\s*<\/td>/g) ?? []).length, 7);
  assert.equal((email.text.match(/Sin movimientos/g) ?? []).length, 7);
  for (const detail of ['Movimientos: 0', 'Pendientes: 0', 'Completados: 0']) {
    assert.ok(email.text.includes(detail));
    assert.ok(email.html.includes(detail));
  }
});
