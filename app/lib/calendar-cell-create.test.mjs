import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

test('openMoveModal acepta fecha y generador predefinidos y mantiene origen = ubicación actual', () => {
  assert.match(page, /openMoveModal = \(presetGeneratorId\?: string, presetDate\?: string\)/);
  assert.match(page, /fecha: presetDate \?\? isoDate\(new Date\(\)\)/);
  assert.match(page, /origen: fixedLocation\(/);
});

test('celdas vacías del calendario son accesibles y solo para editores', () => {
  assert.match(page, /!movements\.length && !isReadOnly/);
  assert.match(page, /role: 'button'/);
  assert.match(page, /tabIndex: 0/);
  assert.match(page, /Crear movimiento generador \$\{generator\.codigo\} el día/);
  assert.match(page, /openMoveModal\(generator\.id, iso\)/);
  assert.match(page, /event\.key === 'Enter' \|\| event\.key === ' '/);
});

test('hay indicador visual al pasar el cursor', () => {
  assert.match(css, /\.calendar-cell\.clickable:hover/);
});
