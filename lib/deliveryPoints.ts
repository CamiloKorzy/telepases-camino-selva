import { supabase } from '@/lib/supabase';
import { PeajeStock } from '@/types/database';

const STORAGE_KEY = 'telepase_master_delivery_points_v4';

const DEFAULT_STATIONS: PeajeStock[] = [
  { estacion: 'Santa Ana', stock_recibido: 0, stock_entregado: 0, stock_minimo_alerta: 150 },
  { estacion: 'Colonia Victoria', stock_recibido: 0, stock_entregado: 0, stock_minimo_alerta: 100 },
  { estacion: 'Paraje Fachinal', stock_recibido: 0, stock_entregado: 0, stock_minimo_alerta: 100 },
  { estacion: 'Ituzaingó', stock_recibido: 0, stock_entregado: 0, stock_minimo_alerta: 100 },
  { estacion: 'Oficina Central', stock_recibido: 0, stock_entregado: 0, stock_minimo_alerta: 100 },
];

/**
 * Obtiene el Maestro Oficial de Puntos de Entrega (Respuesta Inmediata)
 */
export async function getMasterDeliveryPoints(): Promise<PeajeStock[]> {
  let localPoints: PeajeStock[] = [];

  // 1. Leer inmediatamente desde LocalStorage (sin retardo de red)
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

  // Si no hay puntos locales previos, cargar estaciones base oficiales
  if (localPoints.length === 0) {
    localPoints = DEFAULT_STATIONS;
  }

  // 2. Intentar obtener desde Supabase con timeout de 1.5s para no demorar la carga
  try {
    const fetchPromise = supabase.from('peaje_stock').select('*').order('estacion', { ascending: true });
    const timeoutPromise = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 1500));

    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
      const remoteMap = new Map<string, PeajeStock>();
      localPoints.forEach((p) => remoteMap.set(p.estacion.toLowerCase(), p));
      res.data.forEach((p: PeajeStock) => {
        if (!remoteMap.has(p.estacion.toLowerCase())) {
          remoteMap.set(p.estacion.toLowerCase(), {
            ...p,
            stock_recibido: 0,
            stock_entregado: 0,
          });
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
