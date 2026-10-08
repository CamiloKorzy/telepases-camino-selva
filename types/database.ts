export interface TagDelivery {
  id?: string;
  created_at?: string;
  estacion: string;
  nombre_apellido?: string;
  dni_cuit: string;
  dominio: string;
  tag_serial: string;
  operador_runner: string;
  observaciones?: string;
  sincronizado_glm?: boolean;
  fecha_cruce_glm?: string;
}

export interface PeajeStock {
  id?: string;
  estacion: string;
  stock_recibido: number;
  stock_entregado: number;
  stock_minimo_alerta: number;
  updated_at?: string;
}

export type DeliveryPoint = PeajeStock;

export interface UserProfile {
  id?: string;
  email: string;
  nombre: string;
  password_hash?: string;
  rol: 'Administrador' | 'Operador';
  punto_entrega?: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserSession {
  email: string;
  nombre: string;
  rol: 'Administrador' | 'Operador';
  punto_entrega?: string;
  activo: boolean;
}

export interface TagBatch {
  id?: string;
  created_at?: string;
  estacion: string;
  serial_desde: string;
  serial_hasta: string;
  cantidad: number;
  observaciones?: string;
  usuario_registro: string;
}
