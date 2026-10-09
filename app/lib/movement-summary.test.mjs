import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMovementSummary, getMovementDetailFields } from './movement-summary.ts';

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
  usuario: 'Ana',
  creado_en: '2026-10-08T16:00:00.000Z',
};

test('includes every movement detail, comments, and both times in copied and emailed summaries', () => {
  const summary = buildMovementSummary([movement], [{
    id: 'g-1',
    codigo: 'G-101',
    modelo: 'Volvo 440',
    ubicacion: 'Almacén',
    estado: 'estable',
  }]);

  for (const detail of [
    '2026', 'G-101', 'Volvo 440', 'Almacén', 'Obra norte', '08:30', '10:15',
    'Local', 'Llamar antes de llegar', 'pendiente', 'Ana', 'Creado',
  ]) {
    assert.ok(summary.text.includes(detail), `plain-text summary should include ${detail}`);
    assert.ok(summary.html.includes(detail), `HTML summary should include ${detail}`);
  }
});

test('shares readable detail fields and uses placeholders for missing values', () => {
  assert.deepEqual(getMovementDetailFields(movement), [
    { label: 'Hora de recogida', value: '08:30' },
    { label: 'Hora de entrega', value: '10:15' },
    { label: 'Transporte', value: 'Local' },
    { label: 'Notas / comentarios', value: 'Llamar antes de llegar' },
  ]);
  assert.deepEqual(getMovementDetailFields({ ...movement, hora_recogida: undefined, hora_entrega: undefined, notas: '  ' }), [
    { label: 'Hora de recogida', value: 'Sin indicar' },
    { label: 'Hora de entrega', value: 'Sin indicar' },
    { label: 'Transporte', value: 'Local' },
    { label: 'Notas / comentarios', value: 'Sin comentarios' },
  ]);
});

test('escapes user-controlled values in HTML and keeps plain text readable', () => {
  const summary = buildMovementSummary([{ ...movement, notas: '<script>alert("x")</script>' }], []);

  assert.ok(summary.text.includes('<script>alert("x")</script>'));
  assert.ok(summary.html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
  assert.ok(!summary.html.includes('<script>'));
});

test('returns a useful empty summary when there are no movements', () => {
  const summary = buildMovementSummary([], []);

  assert.match(summary.text, /No hay movimientos registrados/);
  assert.match(summary.html, /No hay movimientos registrados/);
});

test('supports a custom heading and empty message', () => {
  const summary = buildMovementSummary([], [], {
    heading: 'Detalle de movimientos',
    emptyMessage: 'No hay movimientos esta semana.',
  });

  assert.match(summary.text, /Detalle de movimientos/);
  assert.match(summary.text, /No hay movimientos esta semana/);
  assert.match(summary.html, /<h2>Detalle de movimientos<\/h2>/);
  assert.match(summary.html, /No hay movimientos esta semana/);
});
