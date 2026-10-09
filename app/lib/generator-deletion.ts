import type { Movement } from './types';

export function hasGeneratorMovements(movimientos: Pick<Movement, 'generador_id'>[], generatorId: string) {
  return movimientos.some((movement) => movement.generador_id === generatorId);
}
