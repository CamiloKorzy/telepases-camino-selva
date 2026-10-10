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
  email_contacto?: string;
  celular_contacto?: string;
  sincronizado_glm?: boolean;
  fecha_cruce_glm?: string;
}

export interface PeajeStock {
  id?: string;
  estacion: string;
  stock_recibido: number;
  stock_entregado: number;
  stock_minimo_alerta: number;
  pendientes_recepcion?: number;
  email_notificacion?: string;
  email_remitente?: string;
  nombre_remitente?: string;
  config_smtp?: string;
  envio_email_activo?: boolean;
  envio_whatsapp_activo?: boolean;
  updated_at?: string;
}

export interface ActivationDocConfig {
  id?: string;
  pdf_url?: string;
  pdf_name?: string;
  image_url?: string;
  image_name?: string;
  email_active: boolean;
  whatsapp_active: boolean;
  email_subject?: string;
  email_body_template?: string;
  whatsapp_body_template?: string;
  updated_at?: string;
}

export type DeliveryPoint = PeajeStock;

export interface UserProfile {
  id?: string;
  email: string;
  nombre: string;
  password_hash?: string;
  rol: 'Administrador' | 'Operador' | 'Consulta';
  punto_entrega?: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserSession {
  email: string;
  nombre: string;
  rol: 'Administrador' | 'Operador' | 'Consulta';
  punto_entrega?: string;
  activo: boolean;
}

export interface TagBatch {
  id?: string;
  created_at?: string;
  fecha_recepcion?: string;
  estacion: string;
  serial_desde: string;
  serial_hasta: string;
  cantidad: number;
  numero_remito?: string;
  observaciones?: string;
  usuario_registro: string;
}

export interface TagTransfer {
  id?: string;
  created_at?: string;
  fecha_envio?: string;
  origen: string;
  destino: string;
  serial_desde: string;
  serial_hasta: string;
  cantidad: number;
  estado: 'En Tránsito' | 'Recibido' | 'Cancelado';
  numero_remito_transferencia?: string;
  usuario_envio: string;
  fecha_recepcion?: string;
  usuario_recepcion?: string;
  observaciones?: string;
}

export interface AuditLog {
  id: string;
  created_at: string;
  usuario_email: string;
  usuario_nombre: string;
  usuario_rol: 'Administrador' | 'Operador' | 'Consulta';
  punto_entrega?: string;
  accion: string;
  modulo: 'Autenticación' | 'Entregas' | 'Movimientos' | 'Alta de TAGs' | 'Usuarios' | 'Puntos de Entrega' | 'Series & Auditoría';
  detalle: string;
  metadata?: Record<string, any>;
}
