export type UserRole = 'editor' | 'lector';
export type GeneratorStatus = 'estable' | 'en-oficina' | 'en-transito';
export type MovementStatus = 'pendiente' | 'completado';
export type TransportType = 'Propio' | 'Local' | 'Nacex';

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  passwordHash: string;
}

export interface Generator {
  id: string;
  codigo: string;
  modelo: string;
  ubicacion: string;
  estado: GeneratorStatus;
}

export interface Movement {
  id: string;
  generador_id: string;
  fecha: string;
  origen: string;
  destino: string;
  tipo_transporte: TransportType;
  notas?: string;
  estado: MovementStatus;
  usuario?: string;
  creado_en?: string;
  completado_en?: string;
}

export interface AppState {
  usuarios: User[];
  generadores: Generator[];
  movimientos: Movement[];
  ubicaciones: string[];
  destinatarios: string[];
  me: User | null;
}
