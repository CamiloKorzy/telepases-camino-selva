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

import { TagBatch } from '@/types/database';

export const DEFAULT_BATCHES: TagBatch[] = [
  {
    id: 'batch-santa-ana-default',
    created_at: '2026-10-01T00:00:00.000Z',
    estacion: 'Santa Ana',
    serial_desde: '63226500',
    serial_hasta: '63227000',
    cantidad: 500,
    numero_remito: 'R-001',
    observaciones: 'Lote Inicial de TAGs Santa Ana',
    usuario_registro: 'Sistema / Carga Inicial',
  },
  {
    id: 'batch-colonia-victoria-default',
    created_at: '2026-10-01T00:00:00.000Z',
    estacion: 'Colonia Victoria',
    serial_desde: '63227001',
    serial_hasta: '63227500',
    cantidad: 500,
    numero_remito: 'R-002',
    observaciones: 'Lote Inicial de TAGs Colonia Victoria',
    usuario_registro: 'Sistema / Carga Inicial',
  },
  {
    id: 'batch-fachinal-default',
    created_at: '2026-10-01T00:00:00.000Z',
    estacion: 'Paraje Fachinal',
    serial_desde: '63227501',
    serial_hasta: '63228000',
    cantidad: 500,
    numero_remito: 'R-003',
    observaciones: 'Lote Inicial de TAGs Paraje Fachinal',
    usuario_registro: 'Sistema / Carga Inicial',
  },
  {
    id: 'batch-ituzaingo-default',
    created_at: '2026-10-01T00:00:00.000Z',
    estacion: 'Ituzaingó',
    serial_desde: '63228001',
    serial_hasta: '63228500',
    cantidad: 500,
    numero_remito: 'R-004',
    observaciones: 'Lote Inicial de TAGs Ituzaingó',
    usuario_registro: 'Sistema / Carga Inicial',
  },
  {
    id: 'batch-oficina-central-default',
    created_at: '2026-10-01T00:00:00.000Z',
    estacion: 'Oficina Central',
    serial_desde: '63228501',
    serial_hasta: '63229000',
    cantidad: 500,
    numero_remito: 'R-005',
    observaciones: 'Lote Inicial de TAGs Oficina Central',
    usuario_registro: 'Sistema / Carga Inicial',
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
