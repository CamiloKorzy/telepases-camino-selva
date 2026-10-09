'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TagTransfer, UserSession } from '@/types/database';
import { Truck, PlusCircle, CheckCircle2, AlertCircle, RefreshCw, Hash, FileText, Receipt, ArrowRight, CheckCircle, XCircle, Trash2, Plus, Trash } from 'lucide-react';
import { getMasterDeliveryPoints } from '@/lib/deliveryPoints';
import { validateTransferOut } from '@/lib/inventoryValidation';

import ConfirmModal from '@/components/ConfirmModal';

const LOCAL_TRANSFERS_KEY = 'telepase_local_tag_transfers';

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

export default function TransferManagement({ currentUser, onTransferUpdated }: TransferManagementProps) {
  const [transfers, setTransfers] = useState<TagTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterState, setFilterState] = useState<'Todos' | 'En Tránsito' | 'Recibido'>('Todos');

  // Formulario cabecera
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
  }, []);

  const fetchTransfers = async () => {
    let remoteTransfers: TagTransfer[] = [];
    let localTransfers: TagTransfer[] = [];

    // 1. Leer LocalStorage inmediatamente (0ms)
    const stored = localStorage.getItem(LOCAL_TRANSFERS_KEY);
    if (stored) {
      try {
        localTransfers = JSON.parse(stored);
      } catch {}
    }

    if (localTransfers.length > 0) {
      setTransfers(localTransfers);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. Consultar Supabase en segundo plano con timeout rápido (1.5s)
    try {
      const fetchPromise = supabase
        .from('tag_transfers')
        .select('*')
        .order('created_at', { ascending: false });
      const timeoutPromise = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 1500));

      const res = await Promise.race([fetchPromise, timeoutPromise]);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        remoteTransfers = res.data;
      }
    } catch {}

    const combinedMap = new Map<string, TagTransfer>();
    [...remoteTransfers, ...localTransfers].forEach((t) => {
      const key = t.id || `${t.origen}_${t.destino}_${t.serial_desde}_${t.serial_hasta}`;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, t);
      }
    });

    const combinedList = Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    setTransfers(combinedList);
    setLoading(false);
  };

  useEffect(() => {
    fetchTransfers();
    const handleUpdated = () => fetchTransfers();
    window.addEventListener('tag_transfers_updated', handleUpdated);
    return () => window.removeEventListener('tag_transfers_updated', handleUpdated);
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

      // Control de Inventarios: Validar que el rango enviado pertenezca al origen y esté disponible
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

    // Guardar en Supabase
    try {
      await supabase.from('tag_transfers').insert(validPayloads);
    } catch {}

    // Guardar en LocalStorage
    const stored = localStorage.getItem(LOCAL_TRANSFERS_KEY);
    const prevTransfers: TagTransfer[] = stored ? JSON.parse(stored) : [];
    const updatedTransfers = [...validPayloads, ...prevTransfers];
    localStorage.setItem(LOCAL_TRANSFERS_KEY, JSON.stringify(updatedTransfers));

    // Actualizar estado local (0ms lag)
    setTransfers(updatedTransfers);
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

        setTransfers((prev) => prev.map((item) => (item.id === t.id ? updatedPayload : item)));
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

        setTransfers((prev) => prev.filter((item) => item.id !== t.id));
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

  const isAdmin = currentUser.rol === 'Administrador' || !currentUser.punto_entrega || currentUser.punto_entrega === 'Todos';

  // 1. Filtrar transferencias según el Punto de Entrega del usuario (si es Operador)
  const userVisibleTransfers = transfers.filter((t) => {
    if (isAdmin) return true;
    const userPoint = currentUser.punto_entrega || '';
    return matchStation(t.origen, userPoint) || matchStation(t.destino, userPoint);
  });

  // 2. Aplicar filtro por estado (Todos / En Tránsito / Recibidos)
  const filteredTransfers = userVisibleTransfers.filter((t) => {
    if (filterState === 'Todos') return true;
    return t.estado === filterState;
  });

  return (
    <div className="space-y-6">
      {/* Formulario de Nuevo Envío / Movimiento de Inventario */}
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
          {currentUser.rol === 'Consulta' && (
            <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-sky-600 flex-shrink-0" />
              <span>MODO SOLO LECTURA: Su usuario Auditor / Consulta de Inventarios no tiene permisos para crear movimientos o confirmar recepciones.</span>
            </div>
          )}

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
            disabled={submitting || currentUser.rol === 'Consulta'}
            className="w-full py-3 bg-cs-primary hover:bg-cs-dark text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 uppercase tracking-wider"
          >
            <Truck className="w-4 h-4 text-cs-accent" />
            <span>
              {currentUser.rol === 'Consulta'
                ? 'SOLO LECTURA (REGISTRO DESHABILITADO)'
                : submitting
                ? 'Registrando Envío...'
                : `🚚 REGISTRAR ENVÍO (${totalTagsInForm.toLocaleString('es-AR')} TAGs DE ${origen.toUpperCase()} A ${destino.toUpperCase()})`}
            </span>
          </button>
        </form>
      </div>

      {/* Historial y Control de Movimientos de Inventario */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-cs-primary" />
            <h3 className="font-bold text-base text-slate-900">
              Historial y Control de Movimientos de Inventario
              {!isAdmin && currentUser.punto_entrega && (
                <span className="ml-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  {currentUser.punto_entrega}
                </span>
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
                Todos ({userVisibleTransfers.length})
              </button>
              <button
                onClick={() => setFilterState('En Tránsito')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterState === 'En Tránsito' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                En Tránsito ({userVisibleTransfers.filter((t) => t.estado === 'En Tránsito').length})
              </button>
              <button
                onClick={() => setFilterState('Recibido')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterState === 'Recibido' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Recibidos ({userVisibleTransfers.filter((t) => t.estado === 'Recibido').length})
              </button>
            </div>

            <button
              onClick={fetchTransfers}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
              title="Recargar movimientos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cs-primary' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-cs-dark text-white">
              <tr>
                <th className="p-3">Fecha Envío</th>
                <th className="p-3">Punto Origen</th>
                <th className="p-3">Punto Destino</th>
                <th className="p-3">Nº Remito TR</th>
                <th className="p-3">Serial Desde</th>
                <th className="p-3">Serial Hasta</th>
                <th className="p-3">Unidades</th>
                <th className="p-3">Estado Movimiento</th>
                <th className="p-3 text-center">Acciones / Confirmación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 font-medium">
                    {!isAdmin && currentUser.punto_entrega
                      ? `No hay movimientos de inventario registrados para la estación ${currentUser.punto_entrega}.`
                      : 'No se han registrado movimientos de inventario aún.'}
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t, idx) => {
                  const canConfirm = currentUser.rol !== 'Consulta' && t.estado === 'En Tránsito' && (isAdmin || matchStation(t.destino, currentUser.punto_entrega));

                  return (
                    <tr key={t.id || idx} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-700 font-mono text-[11px] whitespace-nowrap font-bold">
                        {t.fecha_envio || (t.created_at ? new Date(t.created_at).toLocaleDateString('es-AR') : '-')}
                      </td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{t.origen}</td>
                      <td className="p-3 font-bold text-cs-primary whitespace-nowrap flex items-center space-x-1">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{t.destino}</span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{t.numero_remito_transferencia || '-'}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{t.serial_desde}</td>
                      <td className="p-3 font-mono font-bold text-slate-800">{t.serial_hasta}</td>
                      <td className="p-3 font-bold text-slate-900">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded-full font-mono text-[11px]">
                          {Number(t.cantidad).toLocaleString('es-AR')} u.
                        </span>
                      </td>
                      <td className="p-3">
                        {t.estado === 'Recibido' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                            Recibido ({t.usuario_recepcion || 'Confirmado'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            <Truck className="w-3 h-3 mr-1 text-amber-700" />
                            En Tránsito (Pendiente)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {canConfirm ? (
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleConfirmReception(t)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center space-x-1 shadow-xs"
                              title="Confirmar recepción de TAGs en mi estación"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Confirmar Recepción</span>
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleCancelTransfer(t)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition"
                                title="Cancelar envío"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : t.estado === 'En Tránsito' ? (
                          <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            Pendiente en {t.destino}
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
