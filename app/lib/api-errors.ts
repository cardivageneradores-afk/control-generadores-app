import { NextResponse } from 'next/server';
import { getSupabaseFailureMetadata } from './supabase';
import { StoreError } from './store';

export function withStoreErrorHandling<Arguments extends unknown[]>(
  handler: (...args: Arguments) => Promise<Response>,
  endpoint: string,
) {
  return async (...args: Arguments): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (!(error instanceof StoreError)) throw error;

      console.error(`[${endpoint}] Supabase persistence failure`, getSupabaseFailureMetadata(error.cause));
      const message =
        error.kind === 'schema'
          ? 'La base de datos no está actualizada. Ejecuta las migraciones de Supabase.'
          : error.kind === 'credentials'
            ? 'Las credenciales del servidor para Supabase no son válidas.'
            : error.kind === 'configuration'
              ? 'No se puede conectar con Supabase. Revisa la URL y la clave secreta del servidor.'
              : 'No se pudo consultar la base de datos. Revisa la configuración y las migraciones de Supabase.';
      return NextResponse.json({ error: message }, { status: 503 });
    }
  };
}
