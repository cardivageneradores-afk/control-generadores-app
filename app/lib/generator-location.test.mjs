import assert from 'node:assert/strict';
import test from 'node:test';
import { fixedLocation, normalizeLocation, MAX_LOCATION_LENGTH } from './generator-location.ts';
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
