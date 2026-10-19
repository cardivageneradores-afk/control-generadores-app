export const DEFAULT_FIXED_LOCATION = 'Oficina';
export const MAX_LOCATION_LENGTH = 60;

// Ubicación fija: texto libre, espacios colapsados; vacío o ausente = Oficina.
export function normalizeLocation(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_FIXED_LOCATION;
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, MAX_LOCATION_LENGTH).trim();
  return clean || DEFAULT_FIXED_LOCATION;
}

export function fixedLocation(generator: { ubicacion?: unknown } | null | undefined): string {
  return normalizeLocation(generator?.ubicacion);
}
