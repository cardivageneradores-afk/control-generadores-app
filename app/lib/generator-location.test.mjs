import assert from 'node:assert/strict';
import test from 'node:test';
import { fixedLocation, locationOnDate, normalizeLocation, MAX_LOCATION_LENGTH } from './generator-location.ts';
import { buildWeeklyMovementEmail } from './weekly-movement-email.ts';

test('normalizeLocation usa Oficina por defecto y limpia espacios', () => {
  for (const value of [undefined, null, '', '   ', 5]) assert.equal(normalizeLocation(value), 'Oficina');
  assert.equal(normalizeLocation('  Taller   Mataró '), 'Taller Mataró');
  assert.equal(normalizeLocation('x'.repeat(200)).length, MAX_LOCATION_LENGTH);
});

test('fixedLocation tolera generadores sin ubicación', () => {
  assert.equal(fixedLocation({ ubicacion: 'Puerto' }), 'Puerto');
  assert.equal(fixedLocation({}), 'Oficina');
  assert.equal(fixedLocation(undefined), 'Oficina');
});

test('el correo muestra la ubicación fija de cada generador y Oficina si falta', () => {
  const generators = [
    { id: 'g1', codigo: 'G1', modelo: 'M', ubicacion: 'Puerto de Barcelona', estado: 'estable' },
    { id: 'g2', codigo: 'G2', modelo: 'M', estado: 'estable' },
  ];
  const email = buildWeeklyMovementEmail([], generators, new Date('2026-10-09T10:00:00Z'), { logoCid: 'x' });
  assert.match(email.html, /Ubicación: Puerto de Barcelona/);
  assert.match(email.html, /Ubicación: Oficina/);
  assert.match(email.text, /Ubicación: Puerto de Barcelona/);
  assert.match(email.text, /Ubicación: Oficina/);
});

test('locationOnDate: en el centro desde la entrega hasta la devolución, no antes ni después', () => {
  const generator = { id: 'g1', ubicacion: 'Oficina' };
  const mov = (id, fecha, origen, destino, extra = {}) => ({ id, generador_id: 'g1', fecha, origen, destino, estado: 'pendiente', ...extra });
  const movements = [
    mov('a', '2026-10-28', 'Oficina', 'Mutua Terrassa'),
    mov('b', '2026-10-30', 'Mutua Terrassa', 'Oficina'),
    { ...mov('x', '2026-10-29', 'Otro', 'Otro'), generador_id: 'g2' },
  ];
  assert.equal(locationOnDate(generator, movements, '2026-10-27'), 'Oficina');
  assert.equal(locationOnDate(generator, movements, '2026-10-29'), 'Mutua Terrassa');
  assert.equal(locationOnDate(generator, movements, '2026-10-31'), 'Oficina');
});

test('locationOnDate: antes del primer movimiento pendiente manda la ubicación actual y sin movimientos la ubicación actual', () => {
  const generator = { id: 'g1', ubicacion: 'Taller' };
  assert.equal(locationOnDate(generator, [], '2026-10-29'), 'Taller');
  const later = [{ id: 'a', generador_id: 'g1', fecha: '2026-11-05', origen: 'Puerto', destino: 'Clínica', estado: 'pendiente' }];
  assert.equal(locationOnDate(generator, later, '2026-10-29'), 'Taller');
  const started = [{ ...later[0], resultado: 'entregado' }];
  assert.equal(locationOnDate(generator, started, '2026-10-29'), 'Puerto');
  assert.equal(locationOnDate(generator, later, '2026-11-06'), 'Clínica');
});

test('locationOnDate: Recogido vuelve al origen y tras el último movimiento completado manda la ubicación actual', () => {
  const generator = { id: 'g1', ubicacion: 'Cima' };
  const recogido = [{ id: 'a', generador_id: 'g1', fecha: '2026-10-28', origen: 'Oficina', destino: 'Mutua', estado: 'completado', resultado: 'recogido' }];
  assert.equal(locationOnDate(generator, recogido, '2026-10-29'), 'Cima');
  const seguido = [...recogido, { id: 'b', generador_id: 'g1', fecha: '2026-11-10', origen: 'Cima', destino: 'X', estado: 'pendiente' }];
  assert.equal(locationOnDate(generator, seguido, '2026-10-29'), 'Oficina');
  const entregado = [{ id: 'a', generador_id: 'g1', fecha: '2026-10-28', origen: 'Oficina', destino: 'Mutua', estado: 'pendiente', resultado: 'entregado' }];
  assert.equal(locationOnDate(generator, entregado, '2026-10-29'), 'Mutua');
});

test('el correo semanal muestra la ubicación según el historial del día', () => {
  const generators = [{ id: 'g1', codigo: 'G1', modelo: '', ubicacion: 'Oficina', estado: 'estable' }];
  const movements = [
    { id: 'a', generador_id: 'g1', fecha: '2026-10-26', origen: 'Oficina', destino: 'Mutua Terrassa', tipo_transporte: 'Local', estado: 'pendiente' },
    { id: 'b', generador_id: 'g1', fecha: '2026-10-30', origen: 'Mutua Terrassa', destino: 'Oficina', tipo_transporte: 'Local', estado: 'pendiente' },
  ];
  const { html } = buildWeeklyMovementEmail(movements, generators, new Date('2026-10-26T12:00:00Z'));
  const cell = (date) => html.split(`data-calendar-cell="g1:${date}"`)[1].split('</td>')[0];
  assert.match(cell('2026-10-29'), /Ubicación: Mutua Terrassa/);
  assert.match(cell('2026-10-31'), /Ubicación: Oficina/);
});
test('locationOnDate: hoy, un movimiento entregado el mismo día ya cuenta y uno pendiente no', () => {
  const generator = { id: 'g1', ubicacion: 'Mutua' };
  const base = { id: 'a', generador_id: 'g1', fecha: '2026-10-22', origen: 'Oficina', destino: 'Mutua', estado: 'pendiente' };
  assert.equal(locationOnDate(generator, [base], '2026-10-22'), 'Mutua');
  assert.equal(locationOnDate({ ...generator, ubicacion: 'Oficina' }, [base], '2026-10-22'), 'Oficina');
  assert.equal(locationOnDate(generator, [{ ...base, resultado: 'entregado' }], '2026-10-22'), 'Mutua');
});

test('locationOnDate: recogido (en transito) sigue en el origen y entregado deja el destino', () => {
  const generator = { id: 'g1', ubicacion: 'Oficina' };
  const base = { id: 'a', generador_id: 'g1', fecha: '2026-10-28', origen: 'Oficina', destino: 'Mutua', estado: 'pendiente' };
  assert.equal(locationOnDate(generator, [{ ...base, resultado: 'recogido' }], '2026-10-29'), 'Oficina');
  assert.equal(locationOnDate({ ...generator, ubicacion: 'Mutua' }, [{ ...base, estado: 'completado', resultado: 'entregado' }], '2026-10-29'), 'Mutua');
});
