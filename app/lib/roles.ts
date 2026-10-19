import type { UserRole } from './types';

export const USER_ROLES: readonly UserRole[] = ['editor', 'lector'];

// Tolera mayúsculas, espacios y acentos; solo acepta los roles definidos arriba.
export function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') return null;
  const clean = value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return (USER_ROLES as readonly string[]).includes(clean) ? (clean as UserRole) : null;
}

export function invalidRoleMessage(value: unknown) {
  const shown = typeof value === 'string' && value.trim() ? `«${value.trim().slice(0, 40)}»` : 'vacío';
  return `Tu usuario tiene un rol no válido (${shown}). Solo se permite: ${USER_ROLES.join(', ')}. Pide al administrador que lo corrija.`;
}

export function isEditorRole(value: unknown) {
  return normalizeRole(value) === 'editor';
}

// Convierte la fila de la base de datos en usuario de la app. Un rol desconocido queda como 'lector' y marcado.
export function toAppUser(row: { id: string; email: string; nombre: string; rol: unknown; password_hash: string }) {
  const rol = normalizeRole(row.rol);
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    rol: rol ?? ('lector' as UserRole),
    ...(rol ? {} : { rolInvalido: String(row.rol ?? '') }),
    passwordHash: row.password_hash,
  };
}
