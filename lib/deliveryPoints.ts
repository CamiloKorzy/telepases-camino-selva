import { supabase } from '@/lib/supabase';
import { PeajeStock } from '@/types/database';

const STORAGE_KEY = 'telepase_master_delivery_points_v4';

/**
 * Corrige nombres truncados o erróneos de usuarios o estaciones (ej. "Peaje Colonia Victori" -> "Peaje Colonia Victoria")
 */
export function fixUserName(name?: string | null): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (/victori$/i.test(trimmed)) {
    return trimmed + 'a';
  }
  return trimmed;
}

import { TagBatch, TagTransfer } from '@/types/database';

export const DEFAULT_BATCHES: TagBatch[] = [
  {
    id: 'batch-07102026-master-20k',
    created_at: '2026-10-07T12:00:00.000Z',
    fecha_recepcion: '2026-10-07',
    estacion: 'Oficina Central',
    serial_desde: '63228500',
    serial_hasta: '63248499',
    cantidad: 20000,
    numero_remito: '07102026-1',
    observaciones: 'Alta de Lote Inicial Maestro (20.000 TAGs)',
    usuario_registro: 'Camilo Korzyniewski',
  },
];

export const DEFAULT_TRANSFERS: TagTransfer[] = [
  {
    id: 'tr-20261009-fachinal',
    created_at: '2026-10-09T12:00:00.000Z',
    fecha_envio: '2026-10-09',
    origen: 'Oficina Central',
    destino: 'Paraje Fachinal',
    serial_desde: '63228500',
    serial_hasta: '63229999',
    cantidad: 1500,
    estado: 'Recibido',
    usuario_envio: 'Camilo Korzyniewski',
    usuario_recepcion: 'Camilo Korzyniewski',
    fecha_recepcion: '2026-10-09T12:00:00.000Z',
  },
  {
    id: 'tr-20261009-ituzaingo',
    created_at: '2026-10-09T12:00:00.000Z',
    fecha_envio: '2026-10-09',
    origen: 'Oficina Central',
    destino: 'Ituzaingó',
    serial_desde: '63233000',
    serial_hasta: '63234499',
    cantidad: 1500,
    estado: 'Recibido',
    usuario_envio: 'Camilo Korzyniewski',
    usuario_recepcion: 'Camilo Korzyniewski',
    fecha_recepcion: '2026-10-09T12:00:00.000Z',
  },
  {
    id: 'tr-20261009-victoria',
    created_at: '2026-10-09T12:00:00.000Z',
    fecha_envio: '2026-10-09',
    origen: 'Oficina Central',
    destino: 'Colonia Victoria',
    serial_desde: '63231500',
    serial_hasta: '63232999',
    cantidad: 1500,
    estado: 'Recibido',
    usuario_envio: 'Camilo Korzyniewski',
    usuario_recepcion: 'Camilo Korzyniewski',
    fecha_recepcion: '2026-10-09T12:00:00.000Z',
  },
  {
    id: 'tr-20261009-santaana',
    created_at: '2026-10-09T12:00:00.000Z',
    fecha_envio: '2026-10-09',
    origen: 'Oficina Central',
    destino: 'Santa Ana',
    serial_desde: '63230000',
    serial_hasta: '63231499',
    cantidad: 1500,
    estado: 'Recibido',
    usuario_envio: 'Camilo Korzyniewski',
    usuario_recepcion: 'Camilo Korzyniewski',
    fecha_recepcion: '2026-10-09T12:00:00.000Z',
  },
];

const DEFAULT_STATIONS: PeajeStock[] = [
  { estacion: 'Santa Ana', stock_recibido: 0, stock_entregado: 0, stock_minimo_alerta: 150 },
  { estacion: 'Colonia Victoria', stock_recibido: 0, stock_entregado: 0, stock_minimo_alerta: 100 },
  { estacion: 'Paraje Fachinal', stock_recibido: 0, stock_entregado: 0, stock_minimo_alerta: 100 },
  { estacion: 'Ituzaingó', stock_recibido: 0, stock_entregado: 0, stock_minimo_alerta: 100 },
  { estacion: 'Oficina Central', stock_recibido: 0, stock_entregado: 0, stock_minimo_alerta: 100 },
];

/**
 * Obtiene el Maestro Oficial de Puntos de Entrega Sincrónico (0ms desde LocalStorage)
 */
export function getMasterDeliveryPointsSync(): PeajeStock[] {
  let localPoints: PeajeStock[] = [];

  if (typeof window !== 'undefined') {
    const keysToTry = [
      STORAGE_KEY,
      'telepase_local_delivery_points_v3',
      'telepase_local_delivery_points',
    ];

    for (const key of keysToTry) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localPoints = parsed;
            break;
          }
        } catch {}
      }
    }
  }

  if (localPoints.length === 0) {
    localPoints = DEFAULT_STATIONS;
  }

  return localPoints;
}

/**
 * Obtiene el Maestro Oficial de Puntos de Entrega (Respuesta Inmediata y Sincronización Remota)
 */
export async function getMasterDeliveryPoints(): Promise<PeajeStock[]> {
  let localPoints = getMasterDeliveryPointsSync();

  // 2. Intentar obtener desde Supabase con timeout de 1.5s para no demorar la carga
  try {
    const fetchPromise = supabase.from('peaje_stock').select('*').order('estacion', { ascending: true });
    const timeoutPromise = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 1500));

    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
      const remoteMap = new Map<string, PeajeStock>();
      localPoints.forEach((p) => {
        if (p && p.estacion) remoteMap.set(p.estacion.toLowerCase(), p);
      });
      res.data.forEach((p: PeajeStock) => {
        if (p && p.estacion) {
          const key = p.estacion.toLowerCase();
          const existing = remoteMap.get(key);
          if (!existing) {
            remoteMap.set(key, {
              ...p,
              stock_recibido: 0,
              stock_entregado: 0,
            });
          } else {
            remoteMap.set(key, {
              ...existing,
              email_notificacion: p.email_notificacion || existing.email_notificacion,
              stock_minimo_alerta: p.stock_minimo_alerta || existing.stock_minimo_alerta,
            });
          }
        }
      });
      localPoints = Array.from(remoteMap.values());
    }
  } catch {}

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localPoints));
  }

  return localPoints;
}

/**
 * Guarda un Punto de Entrega en el Maestro
 */
export async function saveMasterDeliveryPoint(point: PeajeStock): Promise<PeajeStock[]> {
  const current = await getMasterDeliveryPoints();
  const existingIdx = current.findIndex((p) => p.estacion.toLowerCase() === point.estacion.toLowerCase());

  let updated: PeajeStock[] = [];
  if (existingIdx >= 0) {
    updated = current.map((p, idx) => (idx === existingIdx ? point : p));
  } else {
    updated = [...current, point];
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('delivery_points_updated'));
  }

  // Guardar en Supabase en segundo plano
  try {
    supabase.from('peaje_stock').upsert([point], { onConflict: 'estacion' }).then();
  } catch {}

  return updated;
}

/**
 * Elimina un Punto de Entrega del Maestro
 */
export async function deleteMasterDeliveryPoint(stationName: string): Promise<PeajeStock[]> {
  const current = await getMasterDeliveryPoints();
  const updated = current.filter((p) => p.estacion.toLowerCase() !== stationName.toLowerCase());

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('delivery_points_updated'));
  }

  // Eliminar en Supabase en segundo plano
  try {
    supabase.from('peaje_stock').delete().eq('estacion', stationName).then();
  } catch {}

  return updated;
}
