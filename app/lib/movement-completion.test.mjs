import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyCompletionLocation, completeMovementWithAction, isDelivered, isPickedUp, movementStatusLabel, parseCompletionAction, sanitizeCompletionNote, MAX_COMPLETION_NOTE_LENGTH } from './movement-completion.ts';

const now = new Date('2026-10-16T09:30:00Z');
const pending = (overrides = {}) => ({ id: 'm1', generador_id: 'g1', origen: 'Oficina', destino: 'Obra Norte', estado: 'pendiente', ...overrides });

test('parseCompletionAction solo acepta entregado o recogido', () => {
  assert.equal(parseCompletionAction('entregado'), 'entregado');
  assert.equal(parseCompletionAction(' Recogido '), 'recogido');
  for (const value of ['completado', '', null, undefined, 1, {}]) assert.equal(parseCompletionAction(value), null);
});

test('recogido es el primer paso: mantiene el movimiento activo y guarda quien/cuando', () => {
  const other = pending({ id: 'm2' });
  const result = completeMovementWithAction([pending(), other], 'm1', 'recogido', 'Transportista', now);
  assert.equal(result.ok, true);
  assert.equal(result.movimiento.estado, 'pendiente');
  assert.equal(result.movimiento.resultado, 'recogido');
  assert.equal(result.movimiento.recogido_por, 'Transportista');
  assert.equal(result.movimiento.recogido_en, now.toISOString());
  assert.equal(result.movimiento.completado_en ?? null, null);
  assert.equal(isPickedUp(result.movimiento), true);
  assert.equal(movementStatusLabel(result.movimiento), 'recogido');
  assert.equal(result.movimientos[1], other);
  assert.deepEqual(completeMovementWithAction(result.movimientos, 'm1', 'recogido', 'x', now), { ok: false, error: 'already_picked_up' });
});

test('entregado exige recogido antes y cierra el movimiento', () => {
  assert.deepEqual(completeMovementWithAction([pending()], 'm1', 'entregado', 'x', now), { ok: false, error: 'not_picked_up' });
  const picked = completeMovementWithAction([pending()], 'm1', 'recogido', 'Ana', now).movimientos;
  const later = new Date('2026-10-17T10:00:00Z');
  const result = completeMovementWithAction(picked, 'm1', 'entregado', 'Luis', later);
  assert.equal(result.ok, true);
  assert.equal(result.movimiento.estado, 'completado');
  assert.equal(result.movimiento.resultado, 'entregado');
  assert.equal(result.movimiento.recogido_por, 'Ana');
  assert.equal(result.movimiento.completado_por, 'Luis');
  assert.equal(result.movimiento.entregado_por, 'Luis');
  assert.equal(result.movimiento.completado_en, later.toISOString());
  assert.equal(movementStatusLabel(result.movimiento), 'completado');
});

test('compatibilidad: un movimiento antiguo pendiente+entregado se cierra con Entregado y no admite Recogido', () => {
  const legacy = pending({ resultado: 'entregado', entregado_por: 'Ana' });
  assert.equal(isDelivered(legacy), true);
  assert.deepEqual(completeMovementWithAction([legacy], 'm1', 'recogido', 'x', now), { ok: false, error: 'already_delivered' });
  const result = completeMovementWithAction([legacy], 'm1', 'entregado', 'Luis', now);
  assert.equal(result.movimiento.estado, 'completado');
});

test('la migracion anade columnas y no toca app_state_revision', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261019150000_movement_delivered_step.sql', import.meta.url), 'utf8');
  assert.match(sql, /entregado_en/);
  assert.match(sql, /entregado_por/);
  assert.match(sql, /replace_app_state/);
  assert.doesNotMatch(sql, /alter table[^;]*app_state_revision/i);
});

test('movimiento inexistente o ya completado se rechaza', () => {
  assert.deepEqual(completeMovementWithAction([pending()], 'zz', 'recogido', 'x', now), { ok: false, error: 'not_found' });
  const done = pending({ estado: 'completado', resultado: 'entregado' });
  assert.deepEqual(completeMovementWithAction([done], 'm1', 'entregado', 'x', now), { ok: false, error: 'already_completed' });
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

test('sanitizeCompletionNote limpia, recorta a 500 y devuelve null si esta vacia', () => {
  assert.equal(sanitizeCompletionNote('  Puerta  cerrada\u0000  '), 'Puerta cerrada');
  assert.equal(sanitizeCompletionNote('   '), null);
  assert.equal(sanitizeCompletionNote(42), null);
  assert.equal(sanitizeCompletionNote('a'.repeat(900)).length, MAX_COMPLETION_NOTE_LENGTH);
  assert.equal(sanitizeCompletionNote('<script>x</script>'), '<script>x</script>');
});

test('cada paso guarda su propia nota y entregado conserva la de recogida', () => {
  const picked = completeMovementWithAction([pending()], 'm1', 'recogido', 'Ana', now, 'Sin llave').movimientos;
  assert.equal(picked[0].nota_recogida, 'Sin llave');
  assert.equal(picked[0].nota_entrega ?? null, null);
  const done = completeMovementWithAction(picked, 'm1', 'entregado', 'Luis', now, 'Golpe en carcasa');
  assert.equal(done.movimiento.nota_recogida, 'Sin llave');
  assert.equal(done.movimiento.nota_entrega, 'Golpe en carcasa');
  assert.equal(completeMovementWithAction(picked, 'm1', 'entregado', 'L', now).movimiento.nota_entrega, null);
  assert.deepEqual(completeMovementWithAction(picked, 'm1', 'recogido', 'x', now, 'otra'), { ok: false, error: 'already_picked_up' });
});

test('la migracion del paso de recogida anade columnas y no toca app_state_revision', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261030120000_movement_pickup_step.sql', import.meta.url), 'utf8');
  assert.match(sql, /recogido_en/);
  assert.match(sql, /recogido_por/);
  assert.match(sql, /replace_app_state\(\s*p_usuarios jsonb,[\s\S]*p_expected_revision bigint/);
  assert.doesNotMatch(sql, /alter table[^;]*app_state_revision/i);
});

test('la ruta sanea la nota, la pasa al push y la migracion añade las columnas', () => {
  const route = read('movimientos/[id]/completar/route.ts');
  assert.match(route, /sanitizeCompletionNote\(body\?\.nota\)/);
  assert.match(route, /note,\s*\n\s*\}\)/);
  const sql = readFileSync(new URL('../../supabase/migrations/20261019170000_movement_completion_notes.sql', import.meta.url), 'utf8');
  assert.match(sql, /nota_entrega/);
  assert.match(sql, /nota_recogida/);
  assert.doesNotMatch(sql, /alter table[^;]*app_state_revision/i);
});