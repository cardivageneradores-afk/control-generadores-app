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

// Ubicación actual: la del último movimiento completado con resultado (entregado = destino,
// recogido = origen); si no hay ninguno, la ubicación fija del generador.
export function currentLocation(
  generator: { id: string; ubicacion?: unknown },
  movements: MovementLike[],
  fixed: string,
): string {
  const last = movements
    .filter((movement) => movement.generador_id === generator.id && movement.estado === 'completado' && (movement.resultado === 'entregado' || movement.resultado === 'recogido'))
    .sort((a, b) => String(a.completado_en ?? '').localeCompare(String(b.completado_en ?? '')) || a.id.localeCompare(b.id))
    .at(-1);
  if (!last) return fixed;
  const place = (last.resultado === 'entregado' ? last.destino : last.origen)?.trim();
  return place || fixed;
}
