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
  editado_en?: string | null;
}

export function parseCompletionAction(value: unknown): CompletionAction | null {
  return typeof value === 'string' && (COMPLETION_ACTIONS as readonly string[]).includes(value.trim().toLowerCase())
    ? (value.trim().toLowerCase() as CompletionAction)
    : null;
}

export type CompletionFailure = 'not_found' | 'already_completed';

export function completeMovementWithAction<T extends MovementLike>(
  movements: T[],
  id: string,
  action: CompletionAction,
  completedBy: string,
  now: Date,
): { ok: true; movimientos: T[]; movimiento: T } | { ok: false; error: CompletionFailure } {
  const target = movements.find((movement) => movement.id === id);
  if (!target) return { ok: false, error: 'not_found' };
  if (target.estado !== 'pendiente') return { ok: false, error: 'already_completed' };
  const completedAt = now.toISOString();
  const movimiento = {
    ...target,
    estado: 'completado',
    resultado: action,
    completado_por: completedBy,
    completado_en: completedAt,
    editado_en: completedAt,
  } as T;
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