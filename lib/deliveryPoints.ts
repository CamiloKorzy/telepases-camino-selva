import { supabase } from '@/lib/supabase';
import { PeajeStock } from '@/types/database';

export const MASTER_DEFAULT_POINTS: PeajeStock[] = [
  { estacion: 'Santa Ana', stock_recibido: 2000, stock_entregado: 0, stock_minimo_alerta: 150 },
  { estacion: 'Colonia Victoria', stock_recibido: 1500, stock_entregado: 0, stock_minimo_alerta: 100 },
  { estacion: 'Paraje Fachinal', stock_recibido: 1000, stock_entregado: 0, stock_minimo_alerta: 100 },
  { estacion: 'Ituzaingó', stock_recibido: 1500, stock_entregado: 0, stock_minimo_alerta: 100 },
];

/**
 * Obtiene el Maestro Oficial de Puntos de Entrega (Supabase + LocalStorage + Defaults)
 */
export async function getMasterDeliveryPoints(): Promise<PeajeStock[]> {
  let remotePoints: PeajeStock[] = [];
  let localPoints: PeajeStock[] = [];

  // 1. Intentar obtener desde Supabase (peaje_stock)
  try {
    const { data, error } = await supabase.from('peaje_stock').select('*').order('estacion', { ascending: true });
    if (!error && data && data.length > 0) {
      remotePoints = data;
    }
  } catch {}

  // 2. Intentar obtener desde LocalStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('telepase_local_delivery_points');
    if (stored) {
      try {
        localPoints = JSON.parse(stored);
      } catch {}
    }
  }

  // 3. Combinar maestro asegurando que siempre existan los Puntos de Entrega
  const map = new Map<string, PeajeStock>();

  MASTER_DEFAULT_POINTS.forEach((p) => map.set(p.estacion, p));
  localPoints.forEach((p) => map.set(p.estacion, p));
  remotePoints.forEach((p) => map.set(p.estacion, p));

  const result = Array.from(map.values());

  if (typeof window !== 'undefined') {
    localStorage.setItem('telepase_local_delivery_points', JSON.stringify(result));
  }

  return result;
}

/**
 * Guarda un Punto de Entrega en el Maestro (Supabase y LocalStorage)
 */
export async function saveMasterDeliveryPoint(point: PeajeStock): Promise<PeajeStock[]> {
  // 1. Guardar en Supabase
  try {
    await supabase.from('peaje_stock').upsert([point], { onConflict: 'estacion' });
  } catch {}

  // 2. Guardar en LocalStorage
  const current = await getMasterDeliveryPoints();
  const existingIdx = current.findIndex((p) => p.estacion.toLowerCase() === point.estacion.toLowerCase());

  let updated: PeajeStock[] = [];
  if (existingIdx >= 0) {
    updated = current.map((p, idx) => (idx === existingIdx ? point : p));
  } else {
    updated = [...current, point];
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('telepase_local_delivery_points', JSON.stringify(updated));
    // Disparar evento personalizado para sincronización entre componentes
    window.dispatchEvent(new Event('delivery_points_updated'));
  }

  return updated;
}
