import { supabase } from '@/lib/supabase';
import { PeajeStock } from '@/types/database';

const STORAGE_KEY = 'telepase_local_delivery_points_v3';

/**
 * Obtiene el Maestro Oficial de Puntos de Entrega (Supabase + LocalStorage)
 * Si el usuario no ha dado de alta ningún Punto de Entrega, retorna []
 */
export async function getMasterDeliveryPoints(): Promise<PeajeStock[]> {
  let remotePoints: PeajeStock[] = [];

  // 1. Intentar obtener desde Supabase (peaje_stock)
  try {
    const { data, error } = await supabase.from('peaje_stock').select('*').order('estacion', { ascending: true });
    if (!error && data && data.length > 0) {
      remotePoints = data.map((p) => ({
        ...p,
        stock_recibido: 0, // El stock recibido real se calculará a partir de los lotes/recepciones
      }));
    }
  } catch {}

  // 2. Intentar obtener desde LocalStorage de forma aislada sin fallback hardcodeado
  if (typeof window !== 'undefined') {
    // Limpiar claves antiguas con datos falsos si existen
    localStorage.removeItem('telepase_local_delivery_points');

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      try {
        const localPoints: PeajeStock[] = JSON.parse(stored);
        return localPoints;
      } catch {}
    }
  }

  // 3. Si no se han dado de alta puntos aún, retornar los puntos remotos de Supabase o vacíos []
  const result = remotePoints;

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  }

  return result;
}

/**
 * Guarda un Punto de Entrega en el Maestro (Supabase y LocalStorage)
 */
export async function saveMasterDeliveryPoint(point: PeajeStock): Promise<PeajeStock[]> {
  // 1. Guardar en Supabase si está disponible
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('delivery_points_updated'));
  }

  return updated;
}

/**
 * Elimina un Punto de Entrega del Maestro (Supabase y LocalStorage)
 */
export async function deleteMasterDeliveryPoint(stationName: string): Promise<PeajeStock[]> {
  // 1. Eliminar de Supabase si está disponible
  try {
    await supabase.from('peaje_stock').delete().eq('estacion', stationName);
  } catch {}

  // 2. Eliminar de LocalStorage
  const current = await getMasterDeliveryPoints();
  const updated = current.filter((p) => p.estacion.toLowerCase() !== stationName.toLowerCase());

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('delivery_points_updated'));
  }

  return updated;
}
