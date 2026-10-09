import assert from 'node:assert/strict';
import test from 'node:test';
import { hasGeneratorMovements } from './generator-deletion.ts';

test('blocks deletion when a generator has pending or completed movements', () => {
  for (const estado of ['pendiente', 'completado']) {
    assert.equal(
      hasGeneratorMovements([{ generador_id: 'g-1', estado }], 'g-1'),
      true,
    );
  }
});

test('allows deletion when no movement references the generator', () => {
  assert.equal(hasGeneratorMovements([{ generador_id: 'g-2' }], 'g-1'), false);
  assert.equal(hasGeneratorMovements([], 'g-1'), false);
});
