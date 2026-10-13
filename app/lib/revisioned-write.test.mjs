import assert from 'node:assert/strict';
import test from 'node:test';
import { replaceRevisionedState, StaleStateError } from './revisioned-write.ts';

test('concurrent writes from the same snapshot cannot silently overwrite each other', async () => {
  let currentRevision = 4;
  let storedValue = 'initial';
  const rpc = async (_name, parameters) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (parameters.p_expected_revision !== currentRevision) {
      return { data: null, error: { code: '40001', message: 'app_state_revision_conflict' } };
    }
    storedValue = parameters.p_value;
    currentRevision += 1;
    return { data: currentRevision, error: null };
  };

  const outcomes = await Promise.allSettled([
    replaceRevisionedState(rpc, 4, { p_value: 'write A' }),
    replaceRevisionedState(rpc, 4, { p_value: 'write B' }),
  ]);

  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = outcomes.find((result) => result.status === 'rejected');
  assert.ok(rejected.reason instanceof StaleStateError);
  assert.equal(currentRevision, 5);
  assert.ok(['write A', 'write B'].includes(storedValue));
});

test('revisioned writes reject invalid revisions and surface other database errors', async () => {
  await assert.rejects(
    replaceRevisionedState(async () => ({ data: 1, error: null }), -1, {}),
    TypeError,
  );
  await assert.rejects(
    replaceRevisionedState(
      async () => ({ data: null, error: { code: '42P01', message: 'missing relation' } }),
      0,
      {},
    ),
    (error) => error.message === 'missing relation',
  );
});
