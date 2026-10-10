'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TagBatch, UserSession } from '@/types/database';
import { Layers, PlusCircle, CheckCircle2, AlertCircle, RefreshCw, Hash, FileText, Receipt, Edit2, Trash2, X, Plus, Trash } from 'lucide-react';

import { getMasterDeliveryPoints, DEFAULT_BATCHES } from '@/lib/deliveryPoints';
import ConfirmModal from '@/components/ConfirmModal';

const LOCAL_BATCHES_KEY = 'telepase_local_tag_batches';

interface BatchManagementProps {
  currentUser: UserSession;
  onBatchCreated: () => void;
}

export interface RangeRow {
  id: string;
  serialDesde: string;
  serialHasta: string;
  cantidad: string;
}

export default function BatchManagement({ currentUser, onBatchCreated }: BatchManagementProps) {
  const [batches, setBatches] = useState<TagBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingBatch, setEditingBatch] = useState<TagBatch | null>(null);

  // Formulario de Cabecera de Recepción / Remito
  const [fechaRecepcion, setFechaRecepcion] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [estacion, setEstacion] = useState<string>('Santa Ana');
  const [numeroRemito, setNumeroRemito] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  // Filas dinámicas de rangos de series
  const [rangeRows, setRangeRows] = useState<RangeRow[]>([
    { id: '1', serialDesde: '', serialHasta: '', cantidad: '' },
  ]);

  const [deliveryPoints, setDeliveryPoints] = useState<string[]>([]);

  // Cargar Puntos de Entrega dinámicos desde el maestro
  useEffect(() => {
    const loadPoints = async () => {
      const masterList = await getMasterDeliveryPoints();
      const names = masterList.map((p) => p.estacion);
      setDeliveryPoints(names);
      if (names.length > 0) {
        setEstacion((prev) => prev || names[0]);
      }
    };

    loadPoints();

    const handleUpdated = () => loadPoints();
    window.addEventListener('delivery_points_updated', handleUpdated);
    return () => window.removeEventListener('delivery_points_updated', handleUpdated);
  }, []);

  const fetchBatches = async () => {
    let remoteBatches: TagBatch[] = [];
    let localBatches: TagBatch[] = [];

    // 1. Leer inmediatamente desde LocalStorage sin esperar la red
    const stored = localStorage.getItem(LOCAL_BATCHES_KEY);
    if (stored) {
      try {
        localBatches = JSON.parse(stored);
        // Auto-corregir cantidad de lote inicial registrado previamente con 501 -> 500
        let updated = false;
        localBatches = localBatches.map((b) => {
          if (b.serial_desde === '63226500' && b.serial_hasta === '63227000' && b.cantidad === 501) {
            updated = true;
            return { ...b, cantidad: 500 };
          }
          return b;
        });
        if (updated) {
          localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(localBatches));
        }
      } catch {}
    }

    if (localBatches.length === 0) {
      localBatches = DEFAULT_BATCHES;
    }

    if (localBatches.length > 0) {
      setBatches(localBatches);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. Consultar Supabase en segundo plano con timeout rápido (1.5s)
    try {
      const fetchPromise = supabase
        .from('tag_batches')
        .select('*')
        .order('created_at', { ascending: false });
      const timeoutPromise = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 1500));

      const res = await Promise.race([fetchPromise, timeoutPromise]);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        remoteBatches = res.data;
      }
    } catch {}

    // Combinar sin duplicados
    const combinedMap = new Map<string, TagBatch>();
    [...remoteBatches, ...localBatches].forEach((b) => {
      const key = b.id || `${b.estacion}_${b.serial_desde}_${b.serial_hasta}`;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, b);
      }
    });

    const combinedList = Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    setBatches(combinedList);
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
    const handleUpdated = () => fetchBatches();
    window.addEventListener('tag_batches_updated', handleUpdated);
    return () => window.removeEventListener('tag_batches_updated', handleUpdated);
  }, []);

  // Manejo de cambio de valores en filas de rangos
  const handleRangeRowChange = (id: string, field: keyof RangeRow, value: string) => {
    setRangeRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id !== id) return row;
        const updatedRow = { ...row, [field]: value };

        // Recalcular cantidad si cambian los seriales
        if (field === 'serialDesde' || field === 'serialHasta') {
          const sDesde = field === 'serialDesde' ? value : updatedRow.serialDesde;
          const sHasta = field === 'serialHasta' ? value : updatedRow.serialHasta;

          const numDesde = parseInt(sDesde.replace(/\D/g, ''), 10);
          const numHasta = parseInt(sHasta.replace(/\D/g, ''), 10);

          if (!isNaN(numDesde) && !isNaN(numHasta) && numHasta >= numDesde) {
            const diff = numHasta - numDesde;
            // Si el serial hasta termina en '9' (ej. 63229999, 63231499) o diff+1 es múltiplo redondo, es conteo físico inclusivo (diff + 1)
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

  // Agregar nueva fila de rango
  const handleAddRangeRow = () => {
    // Si la última fila tiene seriales, intentar autocompletar el siguiente Serial Desde
    const lastRow = rangeRows[rangeRows.length - 1];
    let nextSerialDesde = '';
    if (lastRow && lastRow.serialHasta) {
      nextSerialDesde = lastRow.serialHasta; // En regla fin exclusivo, la siguiente inicia donde termina la anterior
    }

    setRangeRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        serialDesde: nextSerialDesde,
        serialHasta: '',
        cantidad: '',
      },
    ]);
  };

  // Eliminar fila de rango
  const handleRemoveRangeRow = (id: string) => {
    if (rangeRows.length <= 1) return;
    setRangeRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Calcular total de TAGs del remito actual en el formulario
  const totalTagsInForm = rangeRows.reduce(
    (acc, row) => acc + (parseInt(row.cantidad, 10) || 0),
    0
  );

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    // Validar que todas las filas tengan datos válidos
    const validPayloads: TagBatch[] = [];
    const timestamp = new Date().toISOString();

    for (let i = 0; i < rangeRows.length; i++) {
      const row = rangeRows[i];
      const desdeClean = row.serialDesde.trim().toUpperCase();
      const hastaClean = row.serialHasta.trim().toUpperCase();
      const parsedCantidad = parseInt(row.cantidad, 10);

      if (!desdeClean || !hastaClean) {
        setMessage({
          type: 'error',
          text: `Fila ${i + 1}: Debe ingresar Serial Desde y Serial Hasta.`,
        });
        setSubmitting(false);
        return;
      }

      if (isNaN(parsedCantidad) || parsedCantidad <= 0) {
        setMessage({
          type: 'error',
          text: `Fila ${i + 1}: La cantidad debe ser un número mayor a 0.`,
        });
        setSubmitting(false);
        return;
      }

      validPayloads.push({
        id: editingBatch && i === 0 ? editingBatch.id : crypto.randomUUID(),
        created_at: editingBatch && i === 0 ? editingBatch.created_at : timestamp,
        fecha_recepcion: fechaRecepcion || timestamp.split('T')[0],
        estacion,
        serial_desde: desdeClean,
        serial_hasta: hastaClean,
        cantidad: parsedCantidad,
        numero_remito: numeroRemito.trim(),
        observaciones: observaciones.trim(),
        usuario_registro: editingBatch
          ? editingBatch.usuario_registro
          : currentUser.nombre || currentUser.email,
      });
    }

    try {
      if (editingBatch && editingBatch.id) {
        await supabase
          .from('tag_batches')
          .update(validPayloads[0])
          .eq('id', editingBatch.id);
      } else {
        await supabase.from('tag_batches').insert(validPayloads);
      }
    } catch {}

    // Actualizar almacenamiento local
    const stored = localStorage.getItem(LOCAL_BATCHES_KEY);
    const prevBatches: TagBatch[] = stored ? JSON.parse(stored) : [];
    let updatedBatches: TagBatch[] = [];

    if (editingBatch) {
      updatedBatches = prevBatches.map((b) =>
        b.id === editingBatch.id ? validPayloads[0] : b
      );
    } else {
      updatedBatches = [...validPayloads, ...prevBatches];
    }
    localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(updatedBatches));

    // Actualizar grilla local de forma inmediata (0ms de retraso)
    setBatches((prev) => {
      const newIds = new Set(validPayloads.map((p) => p.id));
      const filtered = prev.filter((item) => !newIds.has(item.id));
      return [...validPayloads, ...filtered];
    });

    window.dispatchEvent(new Event('tag_batches_updated'));

    setMessage({
      type: 'success',
      text: editingBatch
        ? `¡Lote de ${estacion} actualizado correctamente!`
        : `¡Remito ${numeroRemito ? `Nº ${numeroRemito}` : ''} con ${validPayloads.length} Rango(s) de Series (${totalTagsInForm.toLocaleString('es-AR')} TAGs total) registrado exitosamente para ${estacion}!`,
    });

    handleResetForm();
    setSubmitting(false);

    fetchBatches();
    onBatchCreated();
  };

  const handleStartEditBatch = (b: TagBatch) => {
    setEditingBatch(b);
    setFechaRecepcion(b.fecha_recepcion || new Date().toISOString().split('T')[0]);
    setEstacion(b.estacion);
    setNumeroRemito(b.numero_remito || '');
    setObservaciones(b.observaciones || '');
    setRangeRows([
      {
        id: b.id || '1',
        serialDesde: b.serial_desde,
        serialHasta: b.serial_hasta,
        cantidad: String(b.cantidad),
      },
    ]);
    setMessage(null);
  };

  const handleResetForm = () => {
    setEditingBatch(null);
    setNumeroRemito('');
    setObservaciones('');
    setRangeRows([{ id: '1', serialDesde: '', serialHasta: '', cantidad: '' }]);
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

  const handleDeleteBatch = (b: TagBatch) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Eliminar Lote de TAGs',
      message: `¿Está seguro de que desea eliminar la recepción del lote (${b.serial_desde} - ${b.serial_hasta}) en ${b.estacion}?`,
      confirmText: 'Sí, Eliminar Lote',
      type: 'danger',
      icon: 'trash',
      onConfirm: async () => {
        try {
          if (b.id) {
            await supabase.from('tag_batches').delete().eq('id', b.id);
          }
        } catch {}

        const stored = localStorage.getItem(LOCAL_BATCHES_KEY);
        if (stored) {
          try {
            const prevBatches: TagBatch[] = JSON.parse(stored);
            const updated = prevBatches.filter(
              (item) =>
                item.id !== b.id &&
                !(item.serial_desde === b.serial_desde && item.estacion === b.estacion)
            );
            localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(updated));
          } catch {}
        }

        setBatches((prev) =>
          prev.filter(
            (item) =>
              item.id !== b.id &&
              !(item.serial_desde === b.serial_desde && item.estacion === b.estacion)
          )
        );

        window.dispatchEvent(new Event('tag_batches_updated'));

        setMessage({
          type: 'success',
          text: `Lote de ${b.estacion} (${b.serial_desde} - ${b.serial_hasta}) eliminado correctamente.`,
        });
        onBatchCreated();
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Formulario de Recepción y Alta de Lotes Múltiples */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="bg-cs-dark text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-cs-accent" />
            <h3 className="font-bold text-base">
              {editingBatch
                ? 'Modificar Recepción de Lote de TAGs'
                : 'Recepción y Alta de Remito (Múltiples Rangos de Series)'}
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            {editingBatch && (
              <button
                type="button"
                onClick={handleResetForm}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1 rounded-lg flex items-center space-x-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar Edición</span>
              </button>
            )}
            <span className="text-[11px] font-bold bg-white/10 text-emerald-200 px-3 py-1 rounded-full border border-white/15">
              Función Rol Administrador
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveBatch} className="p-5 space-y-5">
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

          {/* 1. Datos Generales del Remito */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                1. Fecha Recepción *
              </label>
              <input
                type="date"
                value={fechaRecepcion}
                onChange={(e) => setFechaRecepcion(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                2. Punto de Entrega (Destino) *
              </label>
              <select
                value={estacion}
                onChange={(e) => setEstacion(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white text-slate-800"
              >
                {deliveryPoints.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                3. Nº de Remito
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={numeroRemito}
                  onChange={(e) => setNumeroRemito(e.target.value)}
                  placeholder="ej. R-0001-00849"
                  className="w-full p-2.5 pr-8 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white"
                />
                <Receipt className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* 2. Renglones de Rangos de Series del Remito */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Hash className="w-4 h-4 text-cs-primary" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Rangos de Series del Remito (Cálculo Automático de Unidades)
                </h4>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Soporta etiquetas físicas (...999) o cotas de remito (...000)
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
                      placeholder="ej. 63226500"
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
                      placeholder="ej. 63227000"
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
                      placeholder="500"
                      className="w-full p-2 rounded-lg border-2 border-emerald-400 font-mono font-bold text-emerald-900 text-xs bg-emerald-50/60 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="sm:col-span-1 flex items-center justify-center pt-3 sm:pt-0">
                    {rangeRows.length > 1 && !editingBatch && (
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

              {!editingBatch && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleAddRangeRow}
                    className="py-2 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs"
                  >
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>+ Agregar Otro Rango de Series al Remito</span>
                  </button>

                  <div className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                    Total Remito: <span className="text-cs-primary text-sm font-extrabold">{totalTagsInForm.toLocaleString('es-AR')}</span> TAGs ({rangeRows.length} rangos)
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Observaciones del Remito (Opcional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="ej. Remito firmado por transporte oficial TelePASE"
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
            <PlusCircle className="w-4 h-4 text-cs-accent" />
            <span>
              {submitting
                ? 'Habilitando Lote(s)...'
                : `📥 REGISTRAR REMITO (${totalTagsInForm.toLocaleString('es-AR')} TAGs EN ${rangeRows.length} RANGO/S)`}
            </span>
          </button>
        </form>
      </div>

      {/* Listado de Lotes Habilitados */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-cs-primary" />
            <h3 className="font-bold text-base text-slate-900">
              Lotes de TAGs Habilitados por Punto de Entrega
            </h3>
          </div>
          <button
            onClick={fetchBatches}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title="Recargar lotes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cs-primary' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-cs-dark text-white">
              <tr>
                <th className="p-3">Fecha Recepción</th>
                <th className="p-3">Punto de Entrega</th>
                <th className="p-3">Nº Remito</th>
                <th className="p-3">Inicia (Desde)</th>
                <th className="p-3">Termina (Hasta)</th>
                <th className="p-3">Unidades</th>
                <th className="p-3">Registrado Por</th>
                <th className="p-3">Observaciones</th>
                {currentUser.rol === 'Administrador' && <th className="p-3 text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400">
                    No se han registrado lotes de recepción de TAGs aún.
                  </td>
                </tr>
              ) : (
                batches.map((b, idx) => (
                  <tr key={b.id || idx} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-slate-700 font-mono text-[11px] whitespace-nowrap font-bold">
                      {b.fecha_recepcion ||
                        (b.created_at ? new Date(b.created_at).toLocaleDateString('es-AR') : '-')}
                    </td>
                    <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{b.estacion}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {b.numero_remito || '-'}
                    </td>
                    <td className="p-3 font-mono font-bold text-cs-primary">{b.serial_desde}</td>
                    <td className="p-3 font-mono font-bold text-cs-primary">{b.serial_hasta}</td>
                    <td className="p-3 font-bold text-slate-900">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-mono text-[11px]">
                        {Number(b.cantidad).toLocaleString('es-AR')} u.
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 font-semibold">{b.usuario_registro}</td>
                    <td className="p-3 text-slate-500 max-w-[180px] truncate">
                      {b.observaciones || '-'}
                    </td>
                    {currentUser.rol === 'Administrador' && (
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleStartEditBatch(b)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                            title="Editar lote de recepción"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteBatch(b)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                            title="Eliminar lote de recepción"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
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
