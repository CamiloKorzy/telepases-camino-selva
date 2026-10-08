'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TagBatch, UserSession } from '@/types/database';
import { Layers, PlusCircle, CheckCircle2, AlertCircle, RefreshCw, Hash, FileText, Calendar, Receipt } from 'lucide-react';

const LOCAL_BATCHES_KEY = 'telepase_local_tag_batches';

interface BatchManagementProps {
  currentUser: UserSession;
  onBatchCreated: () => void;
}

export default function BatchManagement({ currentUser, onBatchCreated }: BatchManagementProps) {
  const [batches, setBatches] = useState<TagBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulario nuevo lote
  const [fechaRecepcion, setFechaRecepcion] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [estacion, setEstacion] = useState<string>('Santa Ana');
  const [numeroRemito, setNumeroRemito] = useState<string>('');
  const [serialDesde, setSerialDesde] = useState<string>('');
  const [serialHasta, setSerialHasta] = useState<string>('');
  const [cantidadInput, setCantidadInput] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  const [deliveryPoints, setDeliveryPoints] = useState<string[]>([
    'Santa Ana',
    'Colonia Victoria',
    'Paraje Fachinal',
    'Ituzaingó',
  ]);

  // Cargar Puntos de Entrega dinámicos
  useEffect(() => {
    const loadPoints = async () => {
      let points: string[] = [];
      const stored = localStorage.getItem('telepase_local_delivery_points');
      if (stored) {
        try {
          const list = JSON.parse(stored);
          if (Array.isArray(list) && list.length > 0) {
            points = list.map((p: any) => p.estacion);
          }
        } catch {}
      }

      try {
        const { data } = await supabase.from('peaje_stock').select('estacion');
        if (data && data.length > 0) {
          const remoteNames = data.map((d) => d.estacion);
          points = Array.from(new Set([...points, ...remoteNames]));
        }
      } catch {}

      if (points.length > 0) {
        setDeliveryPoints(points);
        setEstacion(points[0]);
      }
    };

    loadPoints();
  }, []);

  // Recalcular cantidad estimada automáticamente cuando cambian los seriales
  useEffect(() => {
    const numDesde = parseInt(serialDesde.replace(/\D/g, ''), 10);
    const numHasta = parseInt(serialHasta.replace(/\D/g, ''), 10);

    if (!isNaN(numDesde) && !isNaN(numHasta) && numHasta >= numDesde) {
      // Si el serial inicial termina en 0000 o 00, se suele contar exacto o inclusive
      const calc = numHasta - numDesde + 1;
      setCantidadInput(String(calc));
    }
  }, [serialDesde, serialHasta]);

  const fetchBatches = async () => {
    setLoading(true);
    let remoteBatches: TagBatch[] = [];
    let localBatches: TagBatch[] = [];

    try {
      const { data } = await supabase
        .from('tag_batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) remoteBatches = data;
    } catch {}

    const stored = localStorage.getItem(LOCAL_BATCHES_KEY);
    if (stored) {
      try {
        localBatches = JSON.parse(stored);
      } catch {}
    }

    // Combinar sin duplicados
    const combinedMap = new Map<string, TagBatch>();
    [...remoteBatches, ...localBatches].forEach((b) => {
      const key = `${b.estacion}_${b.serial_desde}_${b.serial_hasta}`;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, b);
      }
    });

    const combinedList = Array.from(combinedMap.values());
    setBatches(combinedList);
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const desdeClean = serialDesde.trim().toUpperCase();
    const hastaClean = serialHasta.trim().toUpperCase();
    const parsedCantidad = parseInt(cantidadInput, 10);

    if (!desdeClean || !hastaClean) {
      setMessage({ type: 'error', text: 'Debe ingresar el número inicial (Desde) y final (Hasta) del lote.' });
      setSubmitting(false);
      return;
    }

    if (isNaN(parsedCantidad) || parsedCantidad <= 0) {
      setMessage({ type: 'error', text: 'Por favor ingrese una cantidad de unidades válida.' });
      setSubmitting(false);
      return;
    }

    const newBatch: TagBatch = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      fecha_recepcion: fechaRecepcion || new Date().toISOString().split('T')[0],
      estacion,
      serial_desde: desdeClean,
      serial_hasta: hastaClean,
      cantidad: parsedCantidad,
      numero_remito: numeroRemito.trim(),
      observaciones: observaciones.trim(),
      usuario_registro: currentUser.nombre || currentUser.email,
    };

    try {
      const { error } = await supabase.from('tag_batches').insert([
        {
          fecha_recepcion: newBatch.fecha_recepcion,
          estacion: newBatch.estacion,
          serial_desde: newBatch.serial_desde,
          serial_hasta: newBatch.serial_hasta,
          cantidad: newBatch.cantidad,
          numero_remito: newBatch.numero_remito,
          observaciones: newBatch.observaciones,
          usuario_registro: newBatch.usuario_registro,
        },
      ]);

      if (error) console.warn('Supabase no disponible para lotes:', error.message);
    } catch {}

    // Actualizar almacenamiento local
    const stored = localStorage.getItem(LOCAL_BATCHES_KEY);
    const prevBatches: TagBatch[] = stored ? JSON.parse(stored) : [];
    const updatedBatches = [newBatch, ...prevBatches];
    localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(updatedBatches));

    // Actualizar recepción en peaje_stock
    try {
      await supabase.rpc('increment_stock_recibido', {
        p_estacion: estacion,
        p_cantidad: parsedCantidad,
      });
    } catch {}

    setMessage({
      type: 'success',
      text: `¡Lote de ${parsedCantidad} TAGs (del ${desdeClean} al ${hastaClean}) habilitado exitosamente para ${estacion}!`,
    });

    setSerialDesde('');
    setSerialHasta('');
    setCantidadInput('');
    setNumeroRemito('');
    setObservaciones('');
    setSubmitting(false);

    fetchBatches();
    onBatchCreated();
  };

  return (
    <div className="space-y-6">
      {/* Formulario de Recepción y Alta de Lotes */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="bg-cs-dark text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-cs-accent" />
            <h3 className="font-bold text-base">Recepción y Alta de Lotes de TAGs</h3>
          </div>
          <span className="text-[11px] font-bold bg-white/10 text-emerald-200 px-3 py-1 rounded-full border border-white/15">
            Función Rol Administrador
          </span>
        </div>

        <form onSubmit={handleCreateBatch} className="p-5 space-y-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Fecha de Recepción */}
            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                1. Fecha Recepción *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fechaRecepcion}
                  onChange={(e) => setFechaRecepcion(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-slate-50 text-slate-800"
                  required
                />
              </div>
            </div>

            {/* 2. Punto de Entrega */}
            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                2. Punto de Entrega *
              </label>
              <select
                value={estacion}
                onChange={(e) => setEstacion(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-slate-50 text-slate-800"
              >
                {deliveryPoints.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Número de Remito */}
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
                  className="w-full p-2.5 pr-8 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
                />
                <Receipt className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            {/* 4. Serial Desde */}
            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                4. Serial Desde *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={serialDesde}
                  onChange={(e) => setSerialDesde(e.target.value)}
                  placeholder="ej. 63230000"
                  className="w-full p-2.5 pr-8 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
                  required
                />
                <Hash className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            {/* 5. Serial Hasta */}
            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                5. Serial Hasta *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={serialHasta}
                  onChange={(e) => setSerialHasta(e.target.value)}
                  placeholder="ej. 63231500"
                  className="w-full p-2.5 pr-8 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
                  required
                />
                <Hash className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            {/* 6. Cantidad de Unidades (EDITABLE) */}
            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
                6. Cantidad Unidades *
              </label>
              <input
                type="number"
                min="1"
                value={cantidadInput}
                onChange={(e) => setCantidadInput(e.target.value)}
                placeholder="ej. 1500"
                className="w-full p-2.5 rounded-xl border-2 border-cs-primary/60 font-mono font-bold text-cs-dark text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none bg-emerald-50/40"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Observaciones del Lote (Opcional)
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
            <span>{submitting ? 'Habilitando Lote...' : '📥 REGISTRAR LOTE DE TAGS (ALTA DE INVENTARIO)'}</span>
          </button>
        </form>
      </div>

      {/* Listado de Lotes Habilitados */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-cs-primary" />
            <h3 className="font-bold text-base text-slate-900">Lotes de TAGs Habilitados por Punto de Entrega</h3>
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
                <th className="p-3">Serial Desde</th>
                <th className="p-3">Serial Hasta</th>
                <th className="p-3">Unidades</th>
                <th className="p-3">Registrado Por</th>
                <th className="p-3">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No se han registrado lotes de recepción de TAGs aún.
                  </td>
                </tr>
              ) : (
                batches.map((b, idx) => (
                  <tr key={b.id || idx} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-slate-700 font-mono text-[11px] whitespace-nowrap font-bold">
                      {b.fecha_recepcion || (b.created_at ? new Date(b.created_at).toLocaleDateString('es-AR') : '-')}
                    </td>
                    <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{b.estacion}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{b.numero_remito || '-'}</td>
                    <td className="p-3 font-mono font-bold text-cs-primary">{b.serial_desde}</td>
                    <td className="p-3 font-mono font-bold text-cs-primary">{b.serial_hasta}</td>
                    <td className="p-3 font-bold text-slate-900">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-mono text-[11px]">
                        {b.cantidad} u.
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 font-semibold">{b.usuario_registro}</td>
                    <td className="p-3 text-slate-500 max-w-[180px] truncate">{b.observaciones || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
