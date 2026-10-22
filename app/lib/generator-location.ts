export const DEFAULT_FIXED_LOCATION = 'Oficina';
export const MAX_LOCATION_LENGTH = 60;

// Ubicación actual del generador (campo ubicacion): texto libre, espacios colapsados; vacío o ausente = Oficina.
export function normalizeLocation(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_FIXED_LOCATION;
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, MAX_LOCATION_LENGTH).trim();
  return clean || DEFAULT_FIXED_LOCATION;
}

export function fixedLocation(generator: { ubicacion?: unknown } | null | undefined): string {
  return normalizeLocation(generator?.ubicacion);
}

interface TimelineMovement {
  id: string;
  generador_id: string;
  fecha: string;
  origen: string;
  destino: string;
  estado: string;
  resultado?: string | null;
  hora_recogida?: string;
}

function compareMovements(a: TimelineMovement, b: TimelineMovement) {
  return a.fecha.localeCompare(b.fecha)
    || (a.hora_recogida ?? '').localeCompare(b.hora_recogida ?? '')
    || a.id.localeCompare(b.id);
}

// Un movimiento ya cuenta si su fecha es anterior, o si es de ese mismo día y ya está entregado/completado.
function isApplied(movement: TimelineMovement, date: string) {
  return movement.fecha < date || (movement.fecha === date && (movement.estado === 'completado' || Boolean(movement.resultado)));
}

// Ubicación del generador en un día sin movimientos (fecha AAAA-MM-DD), según su historial:
// tras un movimiento está en el destino (o en el origen si se marcó «Recogido»), hasta el siguiente;
// antes del primer movimiento manda la ubicación actual (salvo que ya esté iniciado: entonces, su origen). Sin movimientos (o tras uno ya completado) manda la ubicación actual.
export function locationOnDate(
  generator: { id: string; ubicacion?: unknown },
  movements: TimelineMovement[],
  date: string,
): string {
  const own = movements.filter((movement) => movement.generador_id === generator.id).sort(compareMovements);
  const previousIndex = own.reduce((found, movement, index) => (isApplied(movement, date) ? index : found), -1);
  if (previousIndex >= 0) {
    const previous = own[previousIndex];
    const isLast = previousIndex === own.length - 1;
    if (isLast && previous.estado === 'completado') return fixedLocation(generator);
    return normalizeLocation(previous.resultado === 'recogido' ? previous.origen : previous.destino);
  }
  const next = own.find((movement) => movement.fecha > date || (movement.fecha === date && !isApplied(movement, date)));
  if (next && (next.estado === 'completado' || next.resultado)) return normalizeLocation(next.origen);
  return fixedLocation(generator);
}
