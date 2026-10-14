import { NextResponse } from 'next/server';
import { getSupabaseFailureMetadata } from './supabase';
import { StoreConflictError, StoreError } from './store';

export function withStoreErrorHandling<Arguments extends unknown[]>(
  handler: (...args: Arguments) => Promise<Response>,
  endpoint: string,
) {
  return async (...args: Arguments): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof StoreConflictError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (!(error instanceof StoreError)) throw error;

      console.error(`[${endpoint}] Supabase persistence failure`, getSupabaseFailureMetadata(error.cause));
      const message =
        error.kind === 'schema'
          ? 'La base de datos no está actualizada. Ejecuta todas las migraciones de Supabase, incluida la última migración de concurrencia y límite de intentos.'
          : error.kind === 'credentials'
            ? 'Las credenciales del servidor para Supabase no son válidas.'
            : error.kind === 'configuration'
              ? 'No se puede conectar con Supabase. Revisa la URL y la clave secreta del servidor.'
              : 'No se pudo consultar la base de datos. Revisa la configuración y las migraciones de Supabase.';
      return NextResponse.json({ error: message }, { status: 503 });
    }
  };
}
