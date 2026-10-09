import { TagBatch, TagTransfer, TagDelivery } from '@/types/database';
import { supabase } from '@/lib/supabase';

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

/**
 * Validar si un TAG individual está disponible en una estación para entrega en vía
 */
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
  const stClean = estacion.trim().toLowerCase();

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
    (b) => b.estacion.trim().toLowerCase() === stClean && isSerialInRange(serialClean, b.serial_desde, b.serial_hasta)
  );

  // 3. Verificar si el TAG fue recibido por una transferencia confirmada ("Recibido") a esta estación
  const perteneceTransfRecibida = allTransfers.some(
    (t) => t.destino.trim().toLowerCase() === stClean && t.estado === 'Recibido' && isSerialInRange(serialClean, t.serial_desde, t.serial_hasta)
  );

  // 4. Verificar si el TAG pertenece a una transferencia enviada a esta estación que aún está PENDIENTE DE RECEPCIÓN ("En Tránsito")
  const transfEnTransito = allTransfers.find(
    (t) => t.destino.trim().toLowerCase() === stClean && t.estado === 'En Tránsito' && isSerialInRange(serialClean, t.serial_desde, t.serial_hasta)
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
    (t) => t.origen.trim().toLowerCase() === stClean && t.estado !== 'Cancelado' && isSerialInRange(serialClean, t.serial_desde, t.serial_hasta)
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
  let allBatches: TagBatch[] = getAllBatches();
  let allTransfers: TagTransfer[] = getAllTransfers();
  let allDeliveries: TagDelivery[] = getAllDeliveries();

  try {
    const fetchBatches = supabase.from('tag_batches').select('*');
    const fetchTransfers = supabase.from('tag_transfers').select('*');
    const fetchDeliveries = supabase.from('tag_deliveries').select('*');
    const timeoutPromise = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 1500));

    const [bRes, tRes, dRes] = await Promise.all([
      Promise.race([fetchBatches, timeoutPromise]),
      Promise.race([fetchTransfers, timeoutPromise]),
      Promise.race([fetchDeliveries, timeoutPromise]),
    ]) as any[];

    if (bRes && bRes.data && bRes.data.length > 0) {
      const bMap = new Map<string, TagBatch>();
      [...bRes.data, ...allBatches].forEach((b) => {
        const k = b.id || `${b.estacion}_${b.serial_desde}_${b.serial_hasta}`;
        if (!bMap.has(k)) bMap.set(k, b);
      });
      allBatches = Array.from(bMap.values());
      localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(allBatches));
    }

    if (tRes && tRes.data && tRes.data.length > 0) {
      const tMap = new Map<string, TagTransfer>();
      [...tRes.data, ...allTransfers].forEach((t) => {
        const k = t.id || `${t.origen}_${t.destino}_${t.serial_desde}_${t.serial_hasta}`;
        if (!tMap.has(k)) tMap.set(k, t);
      });
      allTransfers = Array.from(tMap.values());
      localStorage.setItem(LOCAL_TRANSFERS_KEY, JSON.stringify(allTransfers));
    }

    if (dRes && dRes.data && dRes.data.length > 0) {
      const dMap = new Map<string, TagDelivery>();
      [...dRes.data, ...allDeliveries].forEach((d) => {
        const k = d.id || `${d.tag_serial}`;
        if (!dMap.has(k)) dMap.set(k, d);
      });
      allDeliveries = Array.from(dMap.values());
      localStorage.setItem(LOCAL_DELIVERIES_KEY, JSON.stringify(allDeliveries));
    }
  } catch {}

  return validateTagDelivery(estacion, tagSerial, allBatches, allTransfers, allDeliveries);
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
  const origClean = origen.trim().toLowerCase();

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
    (b) => b.estacion.trim().toLowerCase() === origClean && isSubRangeContained(desdeClean, hastaClean, b.serial_desde, b.serial_hasta)
  );

  // 2. O si proviene de una transferencia confirmada recibida en el Origen
  const transfOrigen = allTransfers.some(
    (t) => t.destino.trim().toLowerCase() === origClean && t.estado === 'Recibido' && isSubRangeContained(desdeClean, hastaClean, t.serial_desde, t.serial_hasta)
  );

  if (!loteOrigen && !transfOrigen) {
    return {
      valid: false,
      error: `El rango de TAGs (${desdeClean} al ${hastaClean}) NO pertenece al inventario dado de alta o recibido en ${origen}.`,
    };
  }

  // 3. Verificar si algún TAG de este rango ya fue entregado a un vehículo en vía
  const entregadoEnRango = allDeliveries.find(
    (d) => d.estacion.trim().toLowerCase() === origClean && isSerialInRange(d.tag_serial, desdeClean, hastaClean)
  );
  if (entregadoEnRango) {
    return {
      valid: false,
      error: `El TAG "${entregadoEnRango.tag_serial}" dentro del rango enviado ya fue entregado a un usuario en vía. No se puede transferir.`,
    };
  }

  // 4. Verificar si ya fue transferido previamente fuera de esta estación
  const reTransferido = allTransfers.find(
    (t) => t.origen.trim().toLowerCase() === origClean && t.estado !== 'Cancelado' && isSubRangeContained(desdeClean, hastaClean, t.serial_desde, t.serial_hasta)
  );
  if (reTransferido) {
    return {
      valid: false,
      error: `El rango (${desdeClean} al ${hastaClean}) ya fue enviado anteriormente hacia ${reTransferido.destino} (Estado: ${reTransferido.estado}).`,
    };
  }

  return { valid: true };
}
