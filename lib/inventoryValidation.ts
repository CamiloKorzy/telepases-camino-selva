import { TagBatch, TagTransfer, TagDelivery } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { DEFAULT_BATCHES, DEFAULT_TRANSFERS } from '@/lib/deliveryPoints';

const LOCAL_BATCHES_KEY = 'telepase_local_tag_batches';
const LOCAL_TRANSFERS_KEY = 'telepase_local_tag_transfers';
const LOCAL_DELIVERIES_KEY = 'telepase_local_tag_deliveries';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Obtiene todos los lotes dados de alta (Supabase + LocalStorage)
 */
export function getAllBatches(): TagBatch[] {
  let localBatches: TagBatch[] = [];
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LOCAL_BATCHES_KEY);
    if (stored) {
      try {
        localBatches = JSON.parse(stored);
      } catch {}
    }
  }

  const isOldSeed = localBatches.some(
    (b) => b && (b.serial_desde === '63226500' || b.cantidad === 500 || b.cantidad === 501)
  );
  const hasRealBatches = localBatches.some((b) => b && b.serial_desde === '63228500');

  if (localBatches.length === 0 || isOldSeed || !hasRealBatches) {
    localBatches = DEFAULT_BATCHES;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(localBatches));
      } catch {}
    }
  }
  return localBatches;
}

/**
 * Obtiene todas las transferencias/movimientos (Supabase + LocalStorage)
 */
export function getAllTransfers(): TagTransfer[] {
  let localTransfers: TagTransfer[] = [];
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LOCAL_TRANSFERS_KEY);
    if (stored) {
      try {
        localTransfers = JSON.parse(stored);
      } catch {}
    }
  }

  const isOldSeed = localTransfers.some(
    (t) => t && (t.serial_desde === '63226500' || t.cantidad === 500 || t.cantidad === 501)
  );
  const hasRealTransfers = localTransfers.some((t) => t && t.serial_desde === '63228500');

  if (localTransfers.length === 0 || isOldSeed || !hasRealTransfers) {
    localTransfers = DEFAULT_TRANSFERS;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_TRANSFERS_KEY, JSON.stringify(localTransfers));
      } catch {}
    }
  }
  return localTransfers;
}

/**
 * Obtiene todas las entregas registradas (Supabase + LocalStorage)
 */
export function getAllDeliveries(): TagDelivery[] {
  let localDeliveries: TagDelivery[] = [];
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LOCAL_DELIVERIES_KEY);
    if (stored) {
      try {
        localDeliveries = JSON.parse(stored);
      } catch {}
    }
  }
  return localDeliveries;
}

/**
 * Verifica si un número de serial individual está dentro de un rango numérico [desde, hasta]
 */
function isSerialInRange(serial: string, desde: string, hasta: string): boolean {
  const sClean = serial.trim().toUpperCase();
  const dClean = desde.trim().toUpperCase();
  const hClean = hasta.trim().toUpperCase();

  const numSerial = parseInt(sClean.replace(/\D/g, ''), 10);
  const numDesde = parseInt(dClean.replace(/\D/g, ''), 10);
  const numHasta = parseInt(hClean.replace(/\D/g, ''), 10);

  if (!isNaN(numSerial) && !isNaN(numDesde) && !isNaN(numHasta)) {
    return numSerial >= numDesde && numSerial <= numHasta;
  }

  return sClean >= dClean && sClean <= hClean;
}

/**
 * Verifica si un sub-rango [subDesde, subHasta] está contenido completamente dentro de un rango maestro [desde, hasta]
 */
function isSubRangeContained(subDesde: string, subHasta: string, desde: string, hasta: string): boolean {
  return isSerialInRange(subDesde, desde, hasta) && isSerialInRange(subHasta, desde, hasta);
}

function cleanStationName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/^(peaje|estaci[oó]n|oficina)\s+/, '')
    .replace(/\s+/g, ' ');
}

/**
 * Refresca en segundo plano el caché de inventario en LocalStorage desde Supabase
 */
export async function refreshInventoryCache(): Promise<void> {
  try {
    const fetchBatches = supabase.from('tag_batches').select('*');
    const fetchTransfers = supabase.from('tag_transfers').select('*');
    const fetchDeliveries = supabase.from('tag_deliveries').select('*');
    const timeoutPromise = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 2000));

    const [bRes, tRes, dRes] = await Promise.all([
      Promise.race([fetchBatches, timeoutPromise]),
      Promise.race([fetchTransfers, timeoutPromise]),
      Promise.race([fetchDeliveries, timeoutPromise]),
    ]) as any[];

    if (bRes && bRes.data) {
      localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(bRes.data));
    }
    if (tRes && tRes.data) {
      localStorage.setItem(LOCAL_TRANSFERS_KEY, JSON.stringify(tRes.data));
    }
    if (dRes && dRes.data) {
      localStorage.setItem(LOCAL_DELIVERIES_KEY, JSON.stringify(dRes.data));
    }
  } catch {}
}

/**
 * Validar si un TAG individual está disponible en una estación para entrega en vía (Sincrónico)
 */
export function validateTagDelivery(
  estacion: string,
  tagSerial: string,
  customBatches?: TagBatch[],
  customTransfers?: TagTransfer[],
  customDeliveries?: TagDelivery[]
): ValidationResult {
  const serialClean = tagSerial.trim().toUpperCase();
  const stClean = cleanStationName(estacion);

  const allBatches = customBatches || getAllBatches();
  const allTransfers = customTransfers || getAllTransfers();
  const allDeliveries = customDeliveries || getAllDeliveries();

  // 1. Verificar si ya fue entregado previamente en cualquier estación
  const yaEntregado = allDeliveries.find(
    (d) => d.tag_serial.trim().toUpperCase() === serialClean
  );
  if (yaEntregado) {
    return {
      valid: false,
      error: `El TAG "${serialClean}" ya fue entregado previamente en la estación "${yaEntregado.estacion}" (Vehículo Dominio: ${yaEntregado.dominio}).`,
    };
  }

  // 2. Verificar si el TAG fue ingresado originalmente por Alta de Lotes en esta estación
  const perteneLoteEstacion = allBatches.some(
    (b) => cleanStationName(b.estacion) === stClean && isSerialInRange(serialClean, b.serial_desde, b.serial_hasta)
  );

  // 3. Verificar si el TAG fue recibido por una transferencia confirmada ("Recibido") a esta estación
  const perteneceTransfRecibida = allTransfers.some(
    (t) => cleanStationName(t.destino) === stClean && t.estado === 'Recibido' && isSerialInRange(serialClean, t.serial_desde, t.serial_hasta)
  );

  // 4. Verificar si el TAG pertenece a una transferencia enviada a esta estación que aún está PENDIENTE DE RECEPCIÓN ("En Tránsito")
  const transfEnTransito = allTransfers.find(
    (t) => cleanStationName(t.destino) === stClean && t.estado === 'En Tránsito' && isSerialInRange(serialClean, t.serial_desde, t.serial_hasta)
  );

  if (!perteneLoteEstacion && !perteneceTransfRecibida) {
    if (transfEnTransito) {
      return {
        valid: false,
        error: `El TAG "${serialClean}" proviene de una transferencia enviada desde "${transfEnTransito.origen}" pero figura PENDIENTE DE RECEPCIÓN en ${estacion}. Debe confirmar la recepción en la pestaña "Movimientos" antes de entregarlo.`,
      };
    }

    return {
      valid: false,
      error: `El TAG "${serialClean}" NO corresponde a ningún lote dado de alta ni a ninguna transferencia recepcionada en la estación "${estacion}". Por favor verifique el número ingresado.`,
    };
  }

  // 5. Verificar si el TAG fue transferido fuera de esta estación hacia otro punto
  const transferidoFuera = allTransfers.find(
    (t) => cleanStationName(t.origen) === stClean && t.estado !== 'Cancelado' && isSerialInRange(serialClean, t.serial_desde, t.serial_hasta)
  );
  if (transferidoFuera) {
    return {
      valid: false,
      error: `El TAG "${serialClean}" fue transferido desde "${estacion}" hacia "${transferidoFuera.destino}" (Estado: ${transferidoFuera.estado}). Ya no se encuentra disponible en ${estacion}.`,
    };
  }

  return { valid: true };
}

/**
 * Validar si un TAG individual está disponible consultando Supabase + LocalStorage en tiempo real
 */
export async function validateTagDeliveryAsync(estacion: string, tagSerial: string): Promise<ValidationResult> {
  await refreshInventoryCache();
  return validateTagDelivery(estacion, tagSerial);
}

/**
 * Encuentra el PRIMER número de TAG disponible en stock en la estación dada que NO haya sido entregado ni transferido.
 */
export function getFirstAvailableTagForStation(estacion: string): string | null {
  if (!estacion) return null;
  const stClean = cleanStationName(estacion);

  const allBatches = getAllBatches();
  const allTransfers = getAllTransfers();

  // 1. Recolectar todos los rangos pertenecientes o recepcionados en esta estación
  const stationRanges: { desde: string; hasta: string }[] = [];

  allBatches.forEach((b) => {
    if (cleanStationName(b.estacion) === stClean) {
      stationRanges.push({ desde: b.serial_desde, hasta: b.serial_hasta });
    }
  });

  allTransfers.forEach((t) => {
    if (cleanStationName(t.destino) === stClean && t.estado === 'Recibido') {
      stationRanges.push({ desde: t.serial_desde, hasta: t.serial_hasta });
    }
  });

  if (stationRanges.length === 0) return null;

  // 2. Recorrer rangos e iterar seriales hasta encontrar el primer disponible
  for (const range of stationRanges) {
    const dClean = range.desde.trim().toUpperCase();
    const hClean = range.hasta.trim().toUpperCase();

    const numMatchD = dClean.match(/\d+/);
    const numMatchH = hClean.match(/\d+/);

    if (numMatchD && numMatchH) {
      const numStrD = numMatchD[0];
      const prefix = dClean.substring(0, dClean.indexOf(numStrD));
      const padLen = numStrD.length;

      const startNum = parseInt(numStrD, 10);
      const endNum = parseInt(numMatchH[0], 10);

      const maxCheck = Math.min(endNum, startNum + 1000);

      for (let n = startNum; n <= maxCheck; n++) {
        const candidateSerial = `${prefix}${String(n).padStart(padLen, '0')}`;
        const valRes = validateTagDelivery(estacion, candidateSerial);
        if (valRes.valid) {
          return candidateSerial;
        }
      }
    } else {
      const valRes = validateTagDelivery(estacion, dClean);
      if (valRes.valid) return dClean;
    }
  }

  return null;
}

/**
 * Validar si un rango de TAGs [serialDesde, serialHasta] se puede enviar desde un Punto Origen
 */
export function validateTransferOut(
  origen: string,
  serialDesde: string,
  serialHasta: string,
  cantidad: number
): ValidationResult {
  const desdeClean = serialDesde.trim().toUpperCase();
  const hastaClean = serialHasta.trim().toUpperCase();
  const origClean = cleanStationName(origen);

  const numDesde = parseInt(desdeClean.replace(/\D/g, ''), 10);
  const numHasta = parseInt(hastaClean.replace(/\D/g, ''), 10);

  if (isNaN(numDesde) || isNaN(numHasta) || numHasta < numDesde) {
    return {
      valid: false,
      error: `Rango de series inválido: ${desdeClean} a ${hastaClean}.`,
    };
  }

  const allBatches = getAllBatches();
  const allTransfers = getAllTransfers();
  const allDeliveries = getAllDeliveries();

  // 1. Verificar si el rango origen proviene de Alta de Lotes en el Origen
  const loteOrigen = allBatches.some(
    (b) => cleanStationName(b.estacion) === origClean && isSubRangeContained(desdeClean, hastaClean, b.serial_desde, b.serial_hasta)
  );

  // 2. O si proviene de una transferencia confirmada recibida en el Origen
  const transfOrigen = allTransfers.some(
    (t) => cleanStationName(t.destino) === origClean && t.estado === 'Recibido' && isSubRangeContained(desdeClean, hastaClean, t.serial_desde, t.serial_hasta)
  );

  if (!loteOrigen && !transfOrigen) {
    return {
      valid: false,
      error: `El rango de TAGs (${desdeClean} al ${hastaClean}) NO pertenece al inventario dado de alta o recibido en ${origen}.`,
    };
  }

  // 3. Verificar si algún TAG de este rango ya fue entregado a un vehículo en vía
  const entregadoEnRango = allDeliveries.find(
    (d) => cleanStationName(d.estacion) === origClean && isSerialInRange(d.tag_serial, desdeClean, hastaClean)
  );
  if (entregadoEnRango) {
    return {
      valid: false,
      error: `El TAG "${entregadoEnRango.tag_serial}" dentro del rango enviado ya fue entregado a un usuario en vía. No se puede transferir.`,
    };
  }

  // 4. Verificar si ya fue transferido previamente fuera de esta estación
  const reTransferido = allTransfers.find(
    (t) => cleanStationName(t.origen) === origClean && t.estado !== 'Cancelado' && isSubRangeContained(desdeClean, hastaClean, t.serial_desde, t.serial_hasta)
  );
  if (reTransferido) {
    return {
      valid: false,
      error: `El rango (${desdeClean} al ${hastaClean}) ya fue enviado anteriormente hacia ${reTransferido.destino} (Estado: ${reTransferido.estado}).`,
    };
  }

  return { valid: true };
}
