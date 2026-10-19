export const COMPLETION_ACTIONS = ['entregado', 'recogido'] as const;
export type CompletionAction = (typeof COMPLETION_ACTIONS)[number];

interface MovementLike {
  id: string;
  generador_id: string;
  origen: string;
  destino: string;
  estado: string;
  completado_en?: string | null;
  resultado?: string | null;
  completado_por?: string | null;
  nota_entrega?: string | null;
  nota_recogida?: string | null;
  editado_en?: string | null;
}

export function parseCompletionAction(value: unknown): CompletionAction | null {
  return typeof value === 'string' && (COMPLETION_ACTIONS as readonly string[]).includes(value.trim().toLowerCase())
    ? (value.trim().toLowerCase() as CompletionAction)
    : null;
}

export const MAX_COMPLETION_NOTE_LENGTH = 500;

// Nota opcional del transportista: texto, sin caracteres de control, espacios normalizados y límite de longitud.
export function sanitizeCompletionNote(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_COMPLETION_NOTE_LENGTH)
    .trim();
  return cleaned || null;
}

export type CompletionFailure = 'not_found' | 'already_completed' | 'already_delivered';

// Entregado deja el movimiento ACTIVO (estado 'pendiente' con resultado 'entregado'); solo Recogido lo completa.
export function isDelivered(movement: { estado: string; resultado?: string | null }) {
  return movement.estado === 'pendiente' && movement.resultado === 'entregado';
}

export function movementStatusLabel(movement: { estado: string; resultado?: string | null }) {
  return isDelivered(movement) ? 'entregado' : movement.estado;
}

export function completeMovementWithAction<T extends MovementLike>(
  movements: T[],
  id: string,
  action: CompletionAction,
  completedBy: string,
  now: Date,
  note: string | null = null,
): { ok: true; movimientos: T[]; movimiento: T } | { ok: false; error: CompletionFailure } {
  const target = movements.find((movement) => movement.id === id);
  if (!target) return { ok: false, error: 'not_found' };
  if (target.estado !== 'pendiente') return { ok: false, error: 'already_completed' };
  if (action === 'entregado' && target.resultado === 'entregado') return { ok: false, error: 'already_delivered' };
  const at = now.toISOString();
  const movimiento = (
    action === 'entregado'
      ? { ...target, resultado: 'entregado', entregado_por: completedBy,       entregado_en: at, nota_entrega: note, editado_en: at }
            : { ...target, estado: 'completado', resultado: 'recogido', completado_por: completedBy, completado_en: at, nota_recogida: note, editado_en: at }
  ) as T;
  return { ok: true, movimiento, movimientos: movements.map((movement) => (movement.id === id ? movimiento : movement)) };
}
// La ubicación actual del generador (campo `ubicacion`) pasa a ser el destino (entregado) o el origen (recogido).
export function applyCompletionLocation<G extends { id: string; ubicacion?: unknown }>(
  generators: G[],
  movement: Pick<MovementLike, 'generador_id' | 'origen' | 'destino' | 'resultado'>,
): G[] {
  const place = (movement.resultado === 'entregado' ? movement.destino : movement.resultado === 'recogido' ? movement.origen : '')?.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!place) return generators;
  return generators.map((generator) => (generator.id === movement.generador_id ? { ...generator, ubicacion: place } : generator));
}