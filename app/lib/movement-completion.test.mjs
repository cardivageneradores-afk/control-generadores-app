import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyCompletionLocation, completeMovementWithAction, parseCompletionAction } from './movement-completion.ts';

const now = new Date('2026-10-16T09:30:00Z');
const pending = (overrides = {}) => ({ id: 'm1', generador_id: 'g1', origen: 'Oficina', destino: 'Obra Norte', estado: 'pendiente', ...overrides });

test('parseCompletionAction solo acepta entregado o recogido', () => {
  assert.equal(parseCompletionAction('entregado'), 'entregado');
  assert.equal(parseCompletionAction(' Recogido '), 'recogido');
  for (const value of ['completado', '', null, undefined, 1, {}]) assert.equal(parseCompletionAction(value), null);
});

test('completar guarda acción, usuario y fecha sin tocar otros movimientos', () => {
  const other = pending({ id: 'm2' });
  const result = completeMovementWithAction([pending(), other], 'm1', 'entregado', 'Transportista', now);
  assert.equal(result.ok, true);
  assert.equal(result.movimiento.estado, 'completado');
  assert.equal(result.movimiento.resultado, 'entregado');
  assert.equal(result.movimiento.completado_por, 'Transportista');
  assert.equal(result.movimiento.completado_en, now.toISOString());
  assert.equal(result.movimientos[1], other);
});

test('movimiento inexistente o ya completado se rechaza', () => {
  assert.deepEqual(completeMovementWithAction([pending()], 'zz', 'recogido', 'x', now), { ok: false, error: 'not_found' });
  const done = pending({ estado: 'completado', resultado: 'entregado' });
  assert.deepEqual(completeMovementWithAction([done], 'm1', 'recogido', 'x', now), { ok: false, error: 'already_completed' });
});

test('al completar, la ubicación actual del generador pasa a destino (entregado) u origen (recogido)', () => {
  const generators = [{ id: 'g1', ubicacion: 'CIMA' }, { id: 'g2', ubicacion: 'Oficina' }];
  const base = { generador_id: 'g1', origen: 'HM Sant Jordi', destino: 'Clínica Corachan' };
  assert.deepEqual(applyCompletionLocation(generators, { ...base, resultado: 'entregado' }), [{ id: 'g1', ubicacion: 'Clínica Corachan' }, generators[1]]);
  assert.equal(applyCompletionLocation(generators, { ...base, resultado: 'recogido' })[0].ubicacion, 'HM Sant Jordi');
  assert.equal(applyCompletionLocation(generators, { ...base, resultado: null }), generators);
  assert.equal(applyCompletionLocation(generators, { ...base, destino: '  ', resultado: 'entregado' }), generators);
});
const read = (path) => readFileSync(new URL(`../api/${path}`, import.meta.url), 'utf8');

test('permisos: completar abre a lector pero exige sesión; el resto exige editor', () => {
  const complete = read('movimientos/[id]/completar/route.ts');
  assert.match(complete, /getPublicUserFromRequest/);
  assert.doesNotMatch(complete, /getEditorFromRequest/);
  assert.match(complete, /status: 401/);
  assert.match(complete, /status: 409/);
  for (const path of [
    'movimientos/route.ts',
    'movimientos/[id]/route.ts',
    'movimientos/[id]/editar/route.ts',
    'generadores/route.ts',
    'generadores/[id]/route.ts',
    'destinatarios/route.ts',
    'destinatarios/[email]/route.ts',
    'usuarios/route.ts',
    'usuarios/[email]/route.ts',
    'enviar-resumen/route.ts',
  ]) {
    assert.match(read(path), /getEditorFromRequest/, `${path} debe exigir editor`);
  }
});
