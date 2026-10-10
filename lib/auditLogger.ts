import { AuditLog, UserSession } from '@/types/database';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

const LOCAL_AUDIT_LOGS_KEY = 'telepase_user_audit_logs';

/**
 * Registra una acción de usuario en el Log de Auditoría (LocalStorage + Supabase)
 * Registra SIEMPRE cualquier operación, sin importar el rol (Administrador, Operador, Consulta).
 */
export function logUserAction(
  session: UserSession | null,
  accion: string,
  modulo: AuditLog['modulo'],
  detalle: string,
  metadata?: Record<string, any>
): void {
  if (typeof window === 'undefined') return;

  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
    usuario_email: session?.email || 'sistema@caminoselva.com',
    usuario_nombre: session?.nombre || 'Usuario Anónimo',
    usuario_rol: session?.rol || 'Operador',
    punto_entrega: session?.punto_entrega || 'Todos',
    accion: accion.toUpperCase(),
    modulo,
    detalle,
    metadata: metadata || {},
  };

  // 1. Guardar localmente en LocalStorage (acceso instantáneo 0ms)
  try {
    const existingRaw = localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
    const existing: AuditLog[] = existingRaw ? JSON.parse(existingRaw) : [];
    // Mantener los últimos 2.000 logs
    const updated = [newLog, ...existing].slice(0, 2000);
    localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(updated));
  } catch {}

  // 2. Intentar guardar asincrónicamente en Supabase (si existe la tabla audit_logs)
  try {
    Promise.resolve(supabase.from('audit_logs').insert([newLog])).catch(() => {});
  } catch {}
}

/**
 * Obtiene todos los logs de auditoría guardados localmente
 */
export function getAuditLogs(): AuditLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
    if (stored) {
      const parsed: AuditLog[] = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Exporta el historial de logs de auditoría a Excel (.xlsx)
 */
export function exportAuditLogsToExcel(logs: AuditLog[]) {
  const data = logs.map((l) => ({
    'Fecha y Hora': l.created_at ? new Date(l.created_at).toLocaleString('es-AR') : '',
    'Usuario (Email)': l.usuario_email,
    'Nombre Usuario': l.usuario_nombre,
    'Rol del Usuario': l.usuario_rol,
    'Punto de Entrega': l.punto_entrega || 'Todos',
    'Módulo Afectado': l.modulo,
    'Acción / Evento': l.accion,
    'Detalle de Operación': l.detalle,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Logs de Auditoría');

  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 28 },
    { wch: 24 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 55 },
  ];

  const fechaHoy = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Logs_Auditoria_TelePASE_${fechaHoy}.xlsx`);
}
