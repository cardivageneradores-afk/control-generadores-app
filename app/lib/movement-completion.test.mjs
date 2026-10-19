import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { completeMovementWithAction, currentLocation, parseCompletionAction } from './movement-completion.ts';

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

test('ubicación actual: entregado = destino, recogido = origen, sin resultado = fija', () => {
  const generator = { id: 'g1' };
  assert.equal(currentLocation(generator, [pending()], 'Oficina'), 'Oficina');
  const legacy = pending({ estado: 'completado', completado_en: '2026-10-01T10:00:00Z' });
  assert.equal(currentLocation(generator, [legacy], 'Oficina'), 'Oficina');
  const delivered = pending({ id: 'a', estado: 'completado', resultado: 'entregado', completado_en: '2026-10-10T10:00:00Z' });
  assert.equal(currentLocation(generator, [delivered], 'Oficina'), 'Obra Norte');
  const picked = pending({ id: 'b', estado: 'completado', resultado: 'recogido', origen: 'Obra Norte', destino: 'Taller', completado_en: '2026-10-12T10:00:00Z' });
  assert.equal(currentLocation(generator, [delivered, picked], 'Oficina'), 'Obra Norte');
  assert.equal(currentLocation({ id: 'g2' }, [delivered, picked], 'Puerto'), 'Puerto');
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
