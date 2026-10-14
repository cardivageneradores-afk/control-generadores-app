export class StaleStateError extends Error {
  constructor() {
    super('The application state changed before this write could be saved.');
    this.name = 'StaleStateError';
  }
}

export async function replaceRevisionedState(
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>,
  revision: number,
  state: Record<string, unknown>,
) {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new TypeError('A valid application state revision is required.');
  }

  const { data, error } = await rpc('replace_app_state', {
    ...state,
    p_expected_revision: revision,
  });
  if (error?.code === '40001' || error?.message === 'app_state_revision_conflict') {
    throw new StaleStateError();
  }
  if (error) throw error;

  const nextRevision =
    typeof data === 'number'
      ? data
      : typeof data === 'string' && /^\d+$/.test(data)
        ? Number(data)
        : Number.NaN;
  if (!Number.isSafeInteger(nextRevision) || nextRevision <= revision) {
    throw new Error('Supabase returned an invalid application state revision.');
  }
  return nextRevision;
}
