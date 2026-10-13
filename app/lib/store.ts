import { DEMO_STATE } from './demo-data';
import { replaceRevisionedState, StaleStateError } from './revisioned-write';
import {
  classifySupabaseFailure,
  getPersistenceConfigurationError,
  supabaseAdmin,
  type SupabaseFailureKind,
} from './supabase';
import type { AppState, Generator, Movement, User } from './types';

function demoEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_DATA === 'true';
}

export class StoreError extends Error {
  readonly kind: SupabaseFailureKind;

  constructor(message: string, cause: unknown, kind = classifySupabaseFailure(cause)) {
    super(message, { cause });
    this.name = 'StoreError';
    this.kind = kind;
  }
}

export class StoreConflictError extends Error {
  constructor() {
    super('La información cambió antes de guardar. Actualiza los datos y vuelve a intentarlo.');
    this.name = 'StoreConflictError';
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

interface PersistedStateSnapshot {
  revision: number | string;
  usuarios: Array<{
    id: string;
    email: string;
    nombre: string;
    rol: User['rol'];
    password_hash: string;
  }>;
  generadores: Generator[];
  movimientos: Movement[];
  destinatarios: string[];
}

function assertSupabase() {
  if (!supabaseAdmin) {
    if (demoEnabled()) return false;
    throw new StoreError(
      getPersistenceConfigurationError() ?? 'Supabase no está configurado.',
      undefined,
      'configuration',
    );
  }
  return true;
}

export async function getStore(): Promise<AppState> {
  if (!assertSupabase()) return clone(DEMO_STATE);

  const { data, error } = await supabaseAdmin!.rpc('read_app_state');
  if (error) throw new StoreError('Error leyendo Supabase.', error);
  if (!data || typeof data !== 'object') {
    throw new StoreError('La base de datos devolvió un estado no válido.', new Error('Invalid app state snapshot.'));
  }
  const snapshot = data as Partial<PersistedStateSnapshot>;
  const revision =
    typeof snapshot.revision === 'number'
      ? snapshot.revision
      : typeof snapshot.revision === 'string' && /^\d+$/.test(snapshot.revision)
        ? Number(snapshot.revision)
        : Number.NaN;
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    !Array.isArray(snapshot.usuarios) ||
    !Array.isArray(snapshot.generadores) ||
    !Array.isArray(snapshot.movimientos) ||
    !Array.isArray(snapshot.destinatarios) ||
    !snapshot.destinatarios.every((email) => typeof email === 'string')
  ) {
    throw new StoreError('La base de datos devolvió un estado no válido.', new Error('Invalid app state snapshot.'));
  }
  const users = snapshot.usuarios as PersistedStateSnapshot['usuarios'];
  const generators = snapshot.generadores as PersistedStateSnapshot['generadores'];
  const movements = snapshot.movimientos as PersistedStateSnapshot['movimientos'];

  return {
    revision,
    usuarios: users.map((row) => ({
      id: row.id,
      email: row.email,
      nombre: row.nombre,
      rol: row.rol,
      passwordHash: row.password_hash,
    })) as User[],
    generadores: generators as Generator[],
    movimientos: movements as Movement[],
    ubicaciones: Array.from(new Set(generators.map((row) => row.ubicacion))).sort(),
    destinatarios: snapshot.destinatarios,
    me: null,
  };
}

export async function setStore(next: AppState): Promise<AppState> {
  if (!assertSupabase()) return clone({ ...next, revision: next.revision + 1 });
  const client = supabaseAdmin!;
  let revision: number;
  try {
    revision = await replaceRevisionedState(
      (name, parameters) => client.rpc(name, parameters),
      next.revision,
      {
        p_usuarios: next.usuarios.map((user) => ({
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          rol: user.rol,
          password_hash: user.passwordHash,
        })),
        p_generadores: next.generadores,
        p_movimientos: next.movimientos.map((movement) => ({
          id: movement.id,
          generador_id: movement.generador_id,
          fecha: movement.fecha,
          origen: movement.origen,
          destino: movement.destino,
          tipo_transporte: movement.tipo_transporte,
          notas: movement.notas ?? null,
          hora_recogida: movement.hora_recogida ?? null,
          hora_entrega: movement.hora_entrega ?? null,
          estado: movement.estado,
          usuario: movement.usuario ?? null,
          creado_en: movement.creado_en ?? null,
          completado_en: movement.completado_en ?? null,
          editado_en: movement.editado_en ?? null,
        })),
        p_destinatarios: next.destinatarios,
      },
    );
  } catch (error) {
    if (error instanceof StaleStateError) throw new StoreConflictError();
    throw new StoreError('Error guardando Supabase.', error);
  }
  return clone({ ...next, revision });
}

export async function updateStore(mutator: (state: AppState) => AppState) {
  const current = await getStore();
  return setStore(mutator(current));
}
