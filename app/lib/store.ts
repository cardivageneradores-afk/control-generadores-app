import { DEMO_STATE } from './demo-data';
import { supabaseAdmin, getPersistenceConfigurationError } from './supabase';
import type { AppState, Generator, Movement, User } from './types';

function demoEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_DATA === 'true';
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertSupabase() {
  if (!supabaseAdmin) {
    if (demoEnabled()) return false;
    throw new Error(getPersistenceConfigurationError() ?? 'Supabase no está configurado.');
  }
  return true;
}

export async function getStore(): Promise<AppState> {
  if (!assertSupabase()) return clone(DEMO_STATE);

  const [users, generators, movements, recipients] = await Promise.all([
    supabaseAdmin!.from('usuarios').select('id,email,nombre,rol,password_hash'),
    supabaseAdmin!.from('generadores').select('id,codigo,modelo,ubicacion,estado'),
    supabaseAdmin!.from('movimientos').select('id,generador_id,fecha,origen,destino,tipo_transporte,notas,estado,usuario,creado_en,completado_en').order('fecha'),
    supabaseAdmin!.from('destinatarios').select('email').order('email'),
  ]);
  for (const result of [users, generators, movements, recipients]) {
    if (result.error) throw new Error(`Error leyendo Supabase: ${result.error.message}`);
  }

  return {
    usuarios: (users.data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      nombre: row.nombre,
      rol: row.rol,
      passwordHash: row.password_hash,
    })) as User[],
    generadores: (generators.data ?? []) as Generator[],
    movimientos: (movements.data ?? []) as Movement[],
    ubicaciones: Array.from(new Set((generators.data ?? []).map((row) => row.ubicacion))).sort(),
    destinatarios: (recipients.data ?? []).map((row) => row.email),
    me: null,
  };
}

export async function setStore(next: AppState): Promise<AppState> {
  if (!assertSupabase()) return clone(next);
  const client = supabaseAdmin!;
  const clear = await Promise.all([
    client.from('movimientos').delete().neq('id', ''),
    client.from('generadores').delete().neq('id', ''),
    client.from('usuarios').delete().neq('id', ''),
    client.from('destinatarios').delete().neq('email', ''),
  ]);
  for (const result of clear) {
    if (result.error) throw new Error(`Error limpiando Supabase: ${result.error.message}`);
  }
  const operations = await Promise.all([
    client.from('usuarios').insert(next.usuarios.map((user) => ({
      id: user.id, email: user.email, nombre: user.nombre, rol: user.rol, password_hash: user.passwordHash,
    }))),
    client.from('generadores').insert(next.generadores),
    client.from('movimientos').insert(next.movimientos.map((movement) => ({
      id: movement.id, generador_id: movement.generador_id, fecha: movement.fecha, origen: movement.origen,
      destino: movement.destino, tipo_transporte: movement.tipo_transporte, notas: movement.notas ?? null,
      estado: movement.estado, usuario: movement.usuario ?? null, creado_en: movement.creado_en ?? null,
      completado_en: movement.completado_en ?? null,
    }))),
    client.from('destinatarios').insert(next.destinatarios.map((email) => ({ email }))),
  ]);
  for (const result of operations) {
    if (result.error) throw new Error(`Error guardando en Supabase: ${result.error.message}`);
  }
  return clone(next);
}

export async function updateStore(mutator: (state: AppState) => AppState) {
  const current = await getStore();
  return setStore(mutator(current));
}
