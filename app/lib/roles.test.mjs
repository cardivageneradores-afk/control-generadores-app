import assert from 'node:assert/strict';
import test from 'node:test';
import { invalidRoleMessage, isEditorRole, normalizeRole, toAppUser, USER_ROLES } from './roles.ts';

test('normalizeRole tolera mayúsculas, espacios y acentos', () => {
  assert.equal(normalizeRole('editor'), 'editor');
  assert.equal(normalizeRole(' Editor '), 'editor');
  assert.equal(normalizeRole('LECTOR'), 'lector');
  assert.equal(normalizeRole('Édítor'), 'editor');
});

test('normalizeRole rechaza valores desconocidos', () => {
  for (const value of ['admin', '', null, undefined, 3, 'editores']) assert.equal(normalizeRole(value), null);
  assert.deepEqual([...USER_ROLES], ['editor', 'lector']);
});

test('isEditorRole solo es cierto para editor', () => {
  assert.equal(isEditorRole('Editor'), true);
  assert.equal(isEditorRole('lector'), false);
  assert.equal(isEditorRole('x'), false);
});

test('invalidRoleMessage es claro y lista los roles permitidos', () => {
  const message = invalidRoleMessage('Administrador');
  assert.match(message, /Administrador/);
  assert.match(message, /editor, lector/);
});

test('toAppUser marca los roles inválidos como lector y conserva el valor', () => {
  const base = { id: '1', email: 'a@b.c', nombre: 'A', password_hash: 'h' };
  assert.equal(toAppUser({ ...base, rol: 'Editor' }).rol, 'editor');
  assert.equal(toAppUser({ ...base, rol: 'Editor' }).rolInvalido, undefined);
  const bad = toAppUser({ ...base, rol: 'jefe' });
  assert.equal(bad.rol, 'lector');
  assert.equal(bad.rolInvalido, 'jefe');
});

test('un cambio de rol en la base se aplica en la siguiente lectura con la misma sesión (sub)', () => {
  // La cookie solo guarda sub y exp; el rol sale de la fila leída en cada petición.
  const sub = 'user-1';
  const row = (rol) => ({ id: sub, email: 'acuevas@cardiva.com', nombre: 'A', rol, password_hash: 'h' });
  const resolve = (rows) => toAppUser(rows.find((r) => r.id === sub));
  assert.equal(isEditorRole(resolve([row('lector')]).rol), false);
  assert.equal(isEditorRole(resolve([row('editor')]).rol), true);
  assert.equal(isEditorRole(resolve([row('lector')]).rol), false);
});
