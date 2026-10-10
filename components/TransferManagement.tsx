'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { TagTransfer, TagBatch, UserSession } from '@/types/database';
import { Truck, PlusCircle, CheckCircle2, AlertCircle, RefreshCw, Hash, FileText, Receipt, ArrowRight, CheckCircle, XCircle, Trash2, Plus, Trash, Layers, FileSpreadsheet, Search, Filter } from 'lucide-react';
import { getMasterDeliveryPoints, fixUserName } from '@/lib/deliveryPoints';
import { validateTransferOut } from '@/lib/inventoryValidation';
import { logUserAction } from '@/lib/auditLogger';

import ConfirmModal from '@/components/ConfirmModal';

const LOCAL_TRANSFERS_KEY = 'telepase_local_tag_transfers';
const LOCAL_BATCHES_KEY = 'telepase_local_tag_batches';

interface TransferManagementProps {
  currentUser: UserSession;
  onTransferUpdated: () => void;
}

interface TransferRangeRow {
  id: string;
  serialDesde: string;
  serialHasta: string;
  cantidad: string;
}

export interface MovementItem {
  id: string;
  created_at?: string;
  fecha: string;
  tipo: 'Ingreso Lote' | 'Transferencia';
  origen: string;
  destino: string;
  serial_desde: string;
  serial_hasta: string;
  cantidad: number;
  estado: 'Ingresado' | 'En Tránsito' | 'Recibido' | 'Cancelado';
  numero_remito?: string;
  usuario_envio: string;
  usuario_recepcion?: string;
  observaciones?: string;
  rawTransfer?: TagTransfer;
}

export default function TransferManagement({ currentUser, onTransferUpdated }: TransferManagementProps) {
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados de Filtros de Reporte y Rastreabilidad
  const [filterState, setFilterState] = useState<'Todos' | 'En Tránsito' | 'Recibido'>('Todos');
  const [dateFilterMode, setDateFilterMode] = useState<'todos' | 'hoy' | 'semana' | 'mes' | 'rango'>('todos');
  const [customFechaDesde, setCustomFechaDesde] = useState<string>('');
  const [customFechaHasta, setCustomFechaHasta] = useState<string>('');
  const [tipoFilter, setTipoFilter] = useState<'Todos' | 'Ingreso Lote' | 'Transferencia'>('Todos');
  const [origenFilter, setOrigenFilter] = useState<string>('Todos');
  const [destinoFilter, setDestinoFilter] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Formulario cabecera (Nuevo Envío)
  const [fechaEnvio, setFechaEnvio] = useState<string>(new Date().toISOString().split('T')[0]);
  const [origen, setOrigen] = useState<string>('Oficina Central');
  const [destino, setDestino] = useState<string>('Santa Ana');
  const [numeroRemito, setNumeroRemito] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // Filas de rangos de series
  const [rangeRows, setRangeRows] = useState<TransferRangeRow[]>([
    { id: '1', serialDesde: '', serialHasta: '', cantidad: '' },
  ]);

  const [deliveryPoints, setDeliveryPoints] = useState<string[]>([]);

  // Cargar Puntos de Entrega
  useEffect(() => {
    const loadPoints = async () => {
      const masterList = await getMasterDeliveryPoints();
      const names = masterList.map((p) => p.estacion);
      setDeliveryPoints(names);
      if (names.length > 0) {
        if (currentUser.punto_entrega && currentUser.punto_entrega !== 'Todos') {
          setOrigen(currentUser.punto_entrega);
          const otherTarget = names.find((n) => n.toLowerCase() !== currentUser.punto_entrega?.toLowerCase());
          if (otherTarget) setDestino(otherTarget);
        } else {
          setOrigen(names[0]);
          if (names.length > 1) {
            setDestino(names[1]);
          }
        }
      }
    };

    loadPoints();
    const handleUpdated = () => loadPoints();
    window.addEventListener('delivery_points_updated', handleUpdated);
    return () => window.removeEventListener('delivery_points_updated', handleUpdated);
  }, [currentUser]);

  const fetchMovements = async () => {
    let localTransfers: TagTransfer[] = [];
    let localBatches: TagBatch[] = [];

    // 1. Leer LocalStorage inmediatamente (0ms)
    const storedTransfers = localStorage.getItem(LOCAL_TRANSFERS_KEY);
    if (storedTransfers) {
      try {
        localTransfers = JSON.parse(storedTransfers);
      } catch {}
    }

    const storedBatches = localStorage.getItem(LOCAL_BATCHES_KEY);
    if (storedBatches) {
      try {
        localBatches = JSON.parse(storedBatches);
      } catch {}
    }

    const buildMovementsList = (batchesList: TagBatch[], transfersList: TagTransfer[]): MovementItem[] => {
      const batchMap = new Map<string, TagBatch>();
      batchesList.forEach((b) => {
        if (!b) return;
        const key = b.id || `${b.estacion}_${b.serial_desde}_${b.serial_hasta}`;
        if (!batchMap.has(key)) batchMap.set(key, b);
      });
      const allBatches = Array.from(batchMap.values());

      const transferMap = new Map<string, TagTransfer>();
      transfersList.forEach((t) => {
        if (!t) return;
        const key = t.id || `${t.origen}_${t.destino}_${t.serial_desde}_${t.serial_hasta}`;
        if (!transferMap.has(key)) transferMap.set(key, t);
      });
      const allTransfers = Array.from(transferMap.values());

      // Convertir Lotes a Movimientos de Ingreso
      const batchItems: MovementItem[] = allBatches.map((b) => ({
        id: b.id || `batch_${b.estacion}_${b.serial_desde}_${b.serial_hasta}`,
        created_at: b.created_at,
        fecha: b.fecha_recepcion || (b.created_at ? b.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
        tipo: 'Ingreso Lote',
        origen: 'Proveedor / Remesa',
        destino: b.estacion || 'Oficina Central',
        serial_desde: b.serial_desde,
        serial_hasta: b.serial_hasta,
        cantidad: Number(b.cantidad) || 0,
        estado: 'Ingresado',
        numero_remito: b.numero_remito || 'Lote Alta',
        usuario_envio: fixUserName(b.usuario_registro || 'Administrador'),
        observaciones: b.observaciones || 'Ingreso de Lote al Sistema',
      }));

      // Convertir Transferencias a Movimientos
      const transferItems: MovementItem[] = allTransfers.map((t) => ({
        id: t.id || `transf_${t.origen}_${t.destino}_${t.serial_desde}_${t.serial_hasta}`,
        created_at: t.created_at,
        fecha: t.fecha_envio || (t.created_at ? t.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
        tipo: 'Transferencia',
        origen: t.origen,
        destino: t.destino,
        serial_desde: t.serial_desde,
        serial_hasta: t.serial_hasta,
        cantidad: Number(t.cantidad) || 0,
        estado: t.estado as any,
        numero_remito: t.numero_remito_transferencia || '-',
        usuario_envio: fixUserName(t.usuario_envio),
        usuario_recepcion: fixUserName(t.usuario_recepcion),
        observaciones: t.observaciones || '',
        rawTransfer: t,
      }));

      return [...batchItems, ...transferItems].sort(
        (a, b) => new Date(b.created_at || b.fecha || 0).getTime() - new Date(a.created_at || a.fecha || 0).getTime()
      );
    };

    // Renderizar datos locales de inmediato (0ms)
    const initialList = buildMovementsList(localBatches, localTransfers);
    setMovements(initialList);
    setLoading(false);

    // 2. Consultar Supabase en paralelo con timeout rápido (1.5s)
    try {
      const timeoutMs = 1500;
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

      const [resTransfers, resBatches] = await Promise.all([
        Promise.race([supabase.from('tag_transfers').select('*').order('created_at', { ascending: false }), timeoutPromise]),
        Promise.race([supabase.from('tag_batches').select('*').order('created_at', { ascending: false }), timeoutPromise]),
      ]);

      let remoteTransfers: TagTransfer[] = [];
      if (resTransfers && resTransfers.data && Array.isArray(resTransfers.data)) {
        remoteTransfers = resTransfers.data;
      }

      let remoteBatches: TagBatch[] = [];
      if (resBatches && resBatches.data && Array.isArray(resBatches.data)) {
        remoteBatches = resBatches.data;
      }

      const mergedList = buildMovementsList(
        [...remoteBatches, ...localBatches],
        [...remoteTransfers, ...localTransfers]
      );
      setMovements(mergedList);
    } catch {}
  };

  useEffect(() => {
    fetchMovements();
    const handleUpdated = () => fetchMovements();
    window.addEventListener('tag_transfers_updated', handleUpdated);
    window.addEventListener('tag_batches_updated', handleUpdated);
    return () => {
      window.removeEventListener('tag_transfers_updated', handleUpdated);
      window.removeEventListener('tag_batches_updated', handleUpdated);
    };
  }, []);

  // Manejo de cambio en filas de rangos
  const handleRangeRowChange = (id: string, field: keyof TransferRangeRow, value: string) => {
    setRangeRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id !== id) return row;
        const updatedRow = { ...row, [field]: value };

        if (field === 'serialDesde' || field === 'serialHasta') {
          const sDesde = field === 'serialDesde' ? value : updatedRow.serialDesde;
          const sHasta = field === 'serialHasta' ? value : updatedRow.serialHasta;

          const numDesde = parseInt(sDesde.replace(/\D/g, ''), 10);
          const numHasta = parseInt(sHasta.replace(/\D/g, ''), 10);

          if (!isNaN(numDesde) && !isNaN(numHasta) && numHasta >= numDesde) {
            const diff = numHasta - numDesde;
            if (sHasta.trim().endsWith('9') || (diff + 1) % 100 === 0 || (diff + 1) % 50 === 0) {
              updatedRow.cantidad = String(diff + 1);
            } else {
              updatedRow.cantidad = String(diff);
            }
          }
        }

        return updatedRow;
      })
    );
  };

  const handleAddRangeRow = () => {
    const lastRow = rangeRows[rangeRows.length - 1];
    let nextSerialDesde = '';
    if (lastRow && lastRow.serialHasta) {
      nextSerialDesde = lastRow.serialHasta;
    }

    setRangeRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), serialDesde: nextSerialDesde, serialHasta: '', cantidad: '' },
    ]);
  };

  const handleRemoveRangeRow = (id: string) => {
    if (rangeRows.length <= 1) return;
    setRangeRows((prev) => prev.filter((r) => r.id !== id));
  };

  const totalTagsInForm = rangeRows.reduce((acc, r) => acc + (parseInt(r.cantidad, 10) || 0), 0);

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    if (origen.toLowerCase() === destino.toLowerCase()) {
      setMessage({ type: 'error', text: 'El Punto de Entrega Destino debe ser diferente al Origen.' });
      setSubmitting(false);
      return;
    }

    const timestamp = new Date().toISOString();
    const validPayloads: TagTransfer[] = [];

    for (let i = 0; i < rangeRows.length; i++) {
      const row = rangeRows[i];
      const desdeClean = row.serialDesde.trim().toUpperCase();
      const hastaClean = row.serialHasta.trim().toUpperCase();
      const parsedCantidad = parseInt(row.cantidad, 10);

      if (!desdeClean || !hastaClean) {
        setMessage({ type: 'error', text: `Fila #${i + 1}: Debe ingresar Serial Desde y Serial Hasta.` });
        setSubmitting(false);
        return;
      }

      if (isNaN(parsedCantidad) || parsedCantidad <= 0) {
        setMessage({ type: 'error', text: `Fila #${i + 1}: La cantidad debe ser mayor a 0.` });
        setSubmitting(false);
        return;
      }

      const valRes = validateTransferOut(origen, desdeClean, hastaClean, parsedCantidad);
      if (!valRes.valid) {
        setMessage({ type: 'error', text: `Fila #${i + 1}: ${valRes.error}` });
        setSubmitting(false);
        return;
      }

      validPayloads.push({
        id: crypto.randomUUID(),
        created_at: timestamp,
        fecha_envio: fechaEnvio || timestamp.split('T')[0],
        origen,
        destino,
        serial_desde: desdeClean,
        serial_hasta: hastaClean,
        cantidad: parsedCantidad,
        estado: 'En Tránsito',
        numero_remito_transferencia: numeroRemito.trim(),
        usuario_envio: currentUser.nombre || currentUser.email,
        observaciones: observaciones.trim(),
      });
    }

    try {
      await supabase.from('tag_transfers').insert(validPayloads);
    } catch {}

    const stored = localStorage.getItem(LOCAL_TRANSFERS_KEY);
    const prevTransfers: TagTransfer[] = stored ? JSON.parse(stored) : [];
    const updatedTransfers = [...validPayloads, ...prevTransfers];
    localStorage.setItem(LOCAL_TRANSFERS_KEY, JSON.stringify(updatedTransfers));

    window.dispatchEvent(new Event('tag_transfers_updated'));

    setMessage({
      type: 'success',
      text: `¡Envío de ${totalTagsInForm.toLocaleString('es-AR')} TAGs de ${origen} a ${destino} registrado en tránsito!`,
    });

    handleResetForm();
    setSubmitting(false);
    onTransferUpdated();
  };

  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    type?: 'primary' | 'danger' | 'warning';
    icon?: 'confirm' | 'danger' | 'warning' | 'truck' | 'trash';
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });

  const handleConfirmReception = (t: TagTransfer) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Confirmar Recepción de Inventario',
      message: `¿Confirmar recepción de ${Number(t.cantidad).toLocaleString('es-AR')} TAGs en ${t.destino}?`,
      confirmText: 'Aceptar Recepción',
      type: 'primary',
      icon: 'truck',
      onConfirm: async () => {
        const updatedPayload: TagTransfer = {
          ...t,
          estado: 'Recibido',
          fecha_recepcion: new Date().toISOString(),
          usuario_recepcion: currentUser.nombre || currentUser.email,
        };

        try {
          if (t.id) {
            await supabase.from('tag_transfers').update(updatedPayload).eq('id', t.id);
          }
        } catch {}

        const stored = localStorage.getItem(LOCAL_TRANSFERS_KEY);
        if (stored) {
          try {
            const prev: TagTransfer[] = JSON.parse(stored);
            const updated = prev.map((item) => (item.id === t.id ? updatedPayload : item));
            localStorage.setItem(LOCAL_TRANSFERS_KEY, JSON.stringify(updated));
          } catch {}
        }

        window.dispatchEvent(new Event('tag_transfers_updated'));
        setMessage({ type: 'success', text: `¡Recepción confirmada exitosamente en ${t.destino}!` });
        onTransferUpdated();
      },
    });
  };

  const handleCancelTransfer = (t: TagTransfer) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Cancelar Transferencia',
      message: `¿Desea cancelar la transferencia de ${t.origen} a ${t.destino}?`,
      confirmText: 'Sí, Cancelar',
      type: 'danger',
      icon: 'trash',
      onConfirm: async () => {
        try {
          if (t.id) {
            await supabase.from('tag_transfers').delete().eq('id', t.id);
          }
        } catch {}

        const stored = localStorage.getItem(LOCAL_TRANSFERS_KEY);
        if (stored) {
          try {
            const prev: TagTransfer[] = JSON.parse(stored);
            const updated = prev.filter((item) => item.id !== t.id);
            localStorage.setItem(LOCAL_TRANSFERS_KEY, JSON.stringify(updated));
          } catch {}
        }

        window.dispatchEvent(new Event('tag_transfers_updated'));
        setMessage({ type: 'success', text: `Transferencia cancelada.` });
        onTransferUpdated();
      },
    });
  };

  const handleResetForm = () => {
    setNumeroRemito('');
    setObservaciones('');
    setRangeRows([{ id: '1', serialDesde: '', serialHasta: '', cantidad: '' }]);
  };

  const matchStation = (a?: string, b?: string): boolean => {
    if (!a || !b) return false;
    const cleanA = a.toLowerCase().replace(/^peaje\s+/, '').trim();
    const cleanB = b.toLowerCase().replace(/^peaje\s+/, '').trim();
    return cleanA === cleanB;
  };

  const isDateInFilter = (dateStr: string | undefined, filterMode: string, customDesde: string, customHasta: string): boolean => {
    if (!dateStr) return false;
    if (filterMode === 'todos') return true;

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filterMode === 'hoy') {
      return d >= startOfToday && d <= endOfToday;
    }

    if (filterMode === 'semana') {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      return d >= startOfWeek && d <= endOfToday;
    }

    if (filterMode === 'mes') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return d >= startOfMonth && d <= endOfToday;
    }

    if (filterMode === 'rango') {
      let matches = true;
      if (customDesde) {
        const fromDate = new Date(customDesde + 'T00:00:00');
        if (!isNaN(fromDate.getTime())) {
          matches = matches && d >= fromDate;
        }
      }
      if (customHasta) {
        const toDate = new Date(customHasta + 'T23:59:59');
        if (!isNaN(toDate.getTime())) {
          matches = matches && d <= toDate;
        }
      }
      return matches;
    }

    return true;
  };

  const canSeeAllMovements =
    currentUser.rol === 'Administrador' ||
    currentUser.rol === 'Consulta' ||
    !currentUser.punto_entrega ||
    currentUser.punto_entrega === 'Todos';

  const isAdmin = currentUser.rol === 'Administrador';

  // 1. Filtrar movimientos visibles según rol (Administradores y usuarios Consulta ven TODO)
  const userVisibleMovements = movements.filter((m) => {
    if (canSeeAllMovements) return true;
    const userPoint = currentUser.punto_entrega || '';
    return matchStation(m.origen, userPoint) || matchStation(m.destino, userPoint);
  });

  // 2. Aplicar filtros completos de reporte: Estado, Tipo, Origen, Destino, Período y Búsqueda por TAG/Remito
  const filteredMovements = userVisibleMovements.filter((m) => {
    // Estado
    if (filterState === 'En Tránsito' && m.estado !== 'En Tránsito') return false;
    if (filterState === 'Recibido' && m.estado !== 'Recibido' && m.estado !== 'Ingresado') return false;

    // Tipo Movimiento
    if (tipoFilter !== 'Todos' && m.tipo !== tipoFilter) return false;

    // Origen
    if (origenFilter !== 'Todos' && m.origen.toLowerCase() !== origenFilter.toLowerCase()) return false;

    // Destino
    if (destinoFilter !== 'Todos' && m.destino.toLowerCase() !== destinoFilter.toLowerCase()) return false;

    // Período de Fecha
    const matchesDate = isDateInFilter(m.created_at || m.fecha, dateFilterMode, customFechaDesde, customFechaHasta);
    if (!matchesDate) return false;

    // Búsqueda por TAG / Serie / Remito / Texto (Rastreabilidad)
    if (searchTerm.trim()) {
      const searchClean = searchTerm.trim().toUpperCase();
      const numSearch = parseInt(searchClean.replace(/\D/g, ''), 10);
      const matchesSerialRange = !isNaN(numSearch) && (() => {
        const numDesde = parseInt(m.serial_desde.replace(/\D/g, ''), 10);
        const numHasta = parseInt(m.serial_hasta.replace(/\D/g, ''), 10);
        return !isNaN(numDesde) && !isNaN(numHasta) && numSearch >= numDesde && numSearch <= numHasta;
      })();

      const matchesText =
        m.numero_remito?.toUpperCase().includes(searchClean) ||
        m.serial_desde.toUpperCase().includes(searchClean) ||
        m.serial_hasta.toUpperCase().includes(searchClean) ||
        m.origen.toUpperCase().includes(searchClean) ||
        m.destino.toUpperCase().includes(searchClean) ||
        m.observaciones?.toUpperCase().includes(searchClean) ||
        m.usuario_envio.toUpperCase().includes(searchClean) ||
        m.usuario_recepcion?.toUpperCase().includes(searchClean) ||
        matchesSerialRange;

      if (!matchesText) return false;
    }

    return true;
  });

  // Exportar reporte de movimientos a Excel (.xlsx) nativo
  const exportToExcel = () => {
    const excelData = filteredMovements.map((m) => ({
      'Fecha': m.fecha,
      'Tipo Movimiento': m.tipo,
      'Punto Origen': m.origen,
      'Punto Destino': m.destino,
      'Nº Remito / Lote': m.numero_remito || '-',
      'Serial Desde': m.serial_desde,
      'Serial Hasta': m.serial_hasta,
      'Unidades': m.cantidad,
      'Estado Movimiento': m.estado,
      'Usuario Registrador / Envío': m.usuario_envio,
      'Usuario Recepción': m.usuario_recepcion || '-',
      'Observaciones': m.observaciones || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimientos de Inventario');

    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 18 },
      { wch: 24 },
      { wch: 24 },
      { wch: 30 },
    ];

    const fechaHoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Reporte_Movimientos_Inventario_TAGs_${fechaHoy}.xlsx`);
  };

  const allStationsOptions = Array.from(
    new Set([...deliveryPoints, 'Oficina Central'])
  );

  return (
    <div className="space-y-6">
      {/* Formulario de Nuevo Envío / Movimiento de Inventario (Oculto para Rol Consulta) */}
      {currentUser.rol !== 'Consulta' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="bg-cs-dark text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Truck className="w-5 h-5 text-cs-accent" />
              <h3 className="font-bold text-base">Movimiento de Inventario entre Puntos de Entrega (Envíos y Recepciones)</h3>
            </div>
            <span className="text-[11px] font-bold bg-white/10 text-emerald-200 px-3 py-1 rounded-full border border-white/15">
              Gestión de Envíos y Logística
            </span>
          </div>

          <form onSubmit={handleSaveTransfer} className="p-5 space-y-5">
            {message && (
              <div
                className={`p-3 rounded-xl flex items-center space-x-2 text-xs font-medium ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* 1. Datos del Envío */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                  1. Fecha de Envío *
                </label>
                <input
                  type="date"
                  value={fechaEnvio}
                  onChange={(e) => setFechaEnvio(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                  2. Origen (Punto Remitente) *
                </label>
                <select
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value)}
                  disabled={!isAdmin}
                  className={`w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none text-slate-800 ${
                    !isAdmin ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                  }`}
                >
                  {deliveryPoints.map((pt) => (
                    <option key={`orig_${pt}`} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                  3. Destino (Punto Destinatario) *
                </label>
                <select
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white text-slate-800"
                >
                  {deliveryPoints.map((pt) => (
                    <option key={`dest_${pt}`} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                  4. Nº Remito de Transferencia
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={numeroRemito}
                    onChange={(e) => setNumeroRemito(e.target.value)}
                    placeholder="ej. TR-001-9821"
                    className="w-full p-2.5 pr-8 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white"
                  />
                  <Receipt className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* 2. Renglones de Series Enviadas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Hash className="w-4 h-4 text-cs-primary" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Rangos de Series del Envío (Cálculo Automático de Unidades)
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Soporta etiquetas físicas (...999) o cotas (...000)
                </span>
              </div>

              <div className="space-y-2 border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                {rangeRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-2xs"
                  >
                    <div className="sm:col-span-1 text-[11px] font-extrabold text-slate-400 text-center">
                      #{idx + 1}
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Inicia (Serial Desde)
                      </label>
                      <input
                        type="text"
                        value={row.serialDesde}
                        onChange={(e) => handleRangeRowChange(row.id, 'serialDesde', e.target.value)}
                        placeholder="ej. 63228500"
                        className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
                        required
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Termina (Serial Hasta)
                      </label>
                      <input
                        type="text"
                        value={row.serialHasta}
                        onChange={(e) => handleRangeRowChange(row.id, 'serialHasta', e.target.value)}
                        placeholder="ej. 63229999"
                        className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-0.5">
                        Cantidad (u.)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={row.cantidad}
                        onChange={(e) => handleRangeRowChange(row.id, 'cantidad', e.target.value)}
                        placeholder="1500"
                        className="w-full p-2 rounded-lg border-2 border-emerald-400 font-mono font-bold text-emerald-900 text-xs bg-emerald-50/60 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="sm:col-span-1 flex items-center justify-center pt-3 sm:pt-0">
                      {rangeRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRangeRow(row.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Eliminar este rango"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleAddRangeRow}
                    className="py-2 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs"
                  >
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>+ Agregar Otro Rango al Envío</span>
                  </button>

                  <div className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                    Total Envío: <span className="text-cs-primary text-sm font-extrabold">{totalTagsInForm.toLocaleString('es-AR')}</span> TAGs ({rangeRows.length} rangos)
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Observaciones del Envío / Chofer Transporte (Opcional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="ej. Traslado interno en camioneta oficial concesionario con Remito de salida"
                  className="w-full p-2.5 pl-9 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                />
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-cs-primary hover:bg-cs-dark text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 uppercase tracking-wider"
            >
              <Truck className="w-4 h-4 text-cs-accent" />
              <span>
                {submitting
                  ? 'Registrando Envío...'
                  : `🚚 REGISTRAR ENVÍO (${totalTagsInForm.toLocaleString('es-AR')} TAGs DE ${origen.toUpperCase()} A ${destino.toUpperCase()})`}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* Historial y Control de Movimientos de Inventario */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-cs-primary" />
            <h3 className="font-bold text-base text-slate-900">
              Historial y Control de Movimientos de Inventario
              {currentUser.rol === 'Consulta' ? (
                <span className="ml-2 text-xs font-bold text-sky-800 bg-sky-100 border border-sky-300 px-2.5 py-0.5 rounded-full">
                  Auditoría Concesión (Todos los Movimientos)
                </span>
              ) : (
                !canSeeAllMovements && currentUser.punto_entrega && (
                  <span className="ml-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    {currentUser.punto_entrega}
                  </span>
                )
              )}
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold">
              <button
                onClick={() => setFilterState('Todos')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterState === 'Todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({userVisibleMovements.length})
              </button>
              <button
                onClick={() => setFilterState('En Tránsito')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterState === 'En Tránsito' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                En Tránsito ({userVisibleMovements.filter((m) => m.estado === 'En Tránsito').length})
              </button>
              <button
                onClick={() => setFilterState('Recibido')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterState === 'Recibido' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Recibidos / Ingresados ({userVisibleMovements.filter((m) => m.estado === 'Recibido' || m.estado === 'Ingresado').length})
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Filtros Avanzados y Exportación Excel para Reportes y Rastreabilidad de TAGs */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-cs-primary" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Filtros de Reporte y Rastreabilidad de TAGs
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Botón Descargar XLSX */}
              <button
                onClick={exportToExcel}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-xs transition"
                title="Descargar reporte completo de movimientos en formato Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Descargar XLSX</span>
              </button>

              <button
                onClick={fetchMovements}
                className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition"
                title="Recargar movimientos"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cs-primary' : ''}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Búsqueda por TAG / Serie / Remito / Lote */}
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                🔍 Identificar / Rastrear TAG o Remito
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ej. 63228505, Remito TR-001..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2 pl-8 text-xs rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* Filtro Tipo Movimiento */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo Movimiento</label>
              <select
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value as any)}
                className="w-full p-2 text-xs rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white text-slate-800"
              >
                <option value="Todos">Todos los Tipos</option>
                <option value="Ingreso Lote">Ingreso Lote (Alta)</option>
                <option value="Transferencia">Transferencia (Envío/Recepción)</option>
              </select>
            </div>

            {/* Filtro Punto Origen */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Punto Origen</label>
              <select
                value={origenFilter}
                onChange={(e) => setOrigenFilter(e.target.value)}
                className="w-full p-2 text-xs rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white text-slate-800"
              >
                <option value="Todos">Todos los Orígenes</option>
                <option value="Proveedor / Remesa">Proveedor / Remesa</option>
                {allStationsOptions.map((st) => (
                  <option key={`orig_flt_${st}`} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Punto Destino */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Punto Destino</label>
              <select
                value={destinoFilter}
                onChange={(e) => setDestinoFilter(e.target.value)}
                className="w-full p-2 text-xs rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white text-slate-800"
              >
                <option value="Todos">Todos los Destinos</option>
                {allStationsOptions.map((st) => (
                  <option key={`dest_flt_${st}`} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selector de Período Temporal */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase">Período:</span>
              <div className="bg-white p-1 rounded-xl flex items-center text-xs font-bold border border-slate-200">
                <button
                  onClick={() => setDateFilterMode('todos')}
                  className={`px-3 py-1 rounded-lg transition ${
                    dateFilterMode === 'todos' ? 'bg-cs-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setDateFilterMode('hoy')}
                  className={`px-3 py-1 rounded-lg transition ${
                    dateFilterMode === 'hoy' ? 'bg-cs-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => setDateFilterMode('semana')}
                  className={`px-3 py-1 rounded-lg transition ${
                    dateFilterMode === 'semana' ? 'bg-cs-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semana
                </button>
                <button
                  onClick={() => setDateFilterMode('mes')}
                  className={`px-3 py-1 rounded-lg transition ${
                    dateFilterMode === 'mes' ? 'bg-cs-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mes
                </button>
                <button
                  onClick={() => setDateFilterMode('rango')}
                  className={`px-3 py-1 rounded-lg transition ${
                    dateFilterMode === 'rango' ? 'bg-cs-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rango de Fechas
                </button>
              </div>

              {dateFilterMode === 'rango' && (
                <div className="flex items-center space-x-2 bg-white p-1.5 rounded-xl border border-slate-200 text-xs">
                  <input
                    type="date"
                    value={customFechaDesde}
                    onChange={(e) => setCustomFechaDesde(e.target.value)}
                    className="p-1 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                  />
                  <span className="text-slate-400 font-bold">a</span>
                  <input
                    type="date"
                    value={customFechaHasta}
                    onChange={(e) => setCustomFechaHasta(e.target.value)}
                    className="p-1 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="text-xs font-bold text-slate-500">
              Registros Encontrados: <b className="text-cs-primary font-mono text-sm">{filteredMovements.length}</b>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-cs-dark text-white">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Tipo Movimiento</th>
                <th className="p-3">Punto Origen</th>
                <th className="p-3">Punto Destino</th>
                <th className="p-3">Nº Remito / Lote</th>
                <th className="p-3">Serial Desde</th>
                <th className="p-3">Serial Hasta</th>
                <th className="p-3">Unidades</th>
                <th className="p-3">Estado Movimiento</th>
                <th className="p-3 text-center">Acciones / Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400 font-medium">
                    {!canSeeAllMovements && currentUser.punto_entrega
                      ? `No hay movimientos de inventario registrados que coincidan con los filtros aplicados.`
                      : 'No se encontraron registros con los filtros seleccionados.'}
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m, idx) => {
                  const isTransfer = m.tipo === 'Transferencia';
                  const rawT = m.rawTransfer;
                  const canConfirm =
                    isTransfer &&
                    rawT &&
                    currentUser.rol !== 'Consulta' &&
                    m.estado === 'En Tránsito' &&
                    (isAdmin || matchStation(m.destino, currentUser.punto_entrega));

                  return (
                    <tr key={m.id || idx} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-700 font-mono text-[11px] whitespace-nowrap font-bold">
                        {m.fecha}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${
                            m.tipo === 'Ingreso Lote'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-sky-50 text-sky-800 border-sky-200'
                          }`}
                        >
                          {m.tipo}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{m.origen}</td>
                      <td className="p-3 font-bold text-cs-primary whitespace-nowrap flex items-center space-x-1">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{m.destino}</span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{m.numero_remito || '-'}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{m.serial_desde}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{m.serial_hasta}</td>
                      <td className="p-3 font-bold text-slate-900">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded-full font-mono text-[11px]">
                          {Number(m.cantidad).toLocaleString('es-AR')} u.
                        </span>
                      </td>
                      <td className="p-3">
                        {m.estado === 'Ingresado' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle className="w-3 h-3 mr-1 text-emerald-700" />
                            Ingresado en {m.destino}
                          </span>
                        ) : m.estado === 'Recibido' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                            Recibido ({m.usuario_recepcion || 'Confirmado'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            <Truck className="w-3 h-3 mr-1 text-amber-700" />
                            En Tránsito (Pendiente)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {canConfirm && rawT ? (
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleConfirmReception(rawT)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center space-x-1 shadow-xs"
                              title="Confirmar recepción de TAGs en mi estación"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Confirmar Recepción</span>
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleCancelTransfer(rawT)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition"
                                title="Cancelar envío"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : m.estado === 'En Tránsito' ? (
                          <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            Pendiente en {m.destino}
                          </span>
                        ) : m.estado === 'Ingresado' ? (
                          <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            Alta de Lote Inicial
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium">
                            Recepción confirmada
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmText={confirmModalState.confirmText}
        type={confirmModalState.type}
        icon={confirmModalState.icon}
        onConfirm={() => {
          confirmModalState.onConfirm();
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
