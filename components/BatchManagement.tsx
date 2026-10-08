'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TagBatch, UserSession } from '@/types/database';
import { Layers, PlusCircle, CheckCircle2, AlertCircle, RefreshCw, Hash, FileText } from 'lucide-react';

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
  const [estacion, setEstacion] = useState<'Santa Ana' | 'Colonia Victoria' | 'Paraje Fachinal' | 'Ituzaingó'>('Santa Ana');
  const [serialDesde, setSerialDesde] = useState('');
  const [serialHasta, setSerialHasta] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Calcular cantidad estimada
  const numDesde = parseInt(serialDesde.replace(/\D/g, ''), 10);
  const numHasta = parseInt(serialHasta.replace(/\D/g, ''), 10);
  const cantidadCalculada = !isNaN(numDesde) && !isNaN(numHasta) && numHasta >= numDesde ? numHasta - numDesde + 1 : 1;

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

    if (!desdeClean || !hastaClean) {
      setMessage({ type: 'error', text: 'Debe ingresar el número inicial (Desde) y final (Hasta) del lote.' });
      setSubmitting(false);
      return;
    }

    const newBatch: TagBatch = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      estacion,
      serial_desde: desdeClean,
      serial_hasta: hastaClean,
      cantidad: cantidadCalculada,
      observaciones: observaciones.trim(),
      usuario_registro: currentUser.nombre || currentUser.email,
    };

    try {
      const { error } = await supabase.from('tag_batches').insert([{
        estacion: newBatch.estacion,
        serial_desde: newBatch.serial_desde,
        serial_hasta: newBatch.serial_hasta,
        cantidad: newBatch.cantidad,
        observaciones: newBatch.observaciones,
        usuario_registro: newBatch.usuario_registro,
      }]);

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
        p_cantidad: cantidadCalculada,
      });
    } catch {}

    setMessage({
      type: 'success',
      text: `¡Lote de ${cantidadCalculada} TAGs (del ${desdeClean} al ${hastaClean}) habilitado exitosamente para ${estacion}!`,
    });

    setSerialDesde('');
    setSerialHasta('');
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
            Inventario Numerado
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">1. Estación de Peaje *</label>
              <select
                value={estacion}
                onChange={(e) => setEstacion(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-slate-50 text-slate-800"
              >
                <option value="Santa Ana">Santa Ana (RN 12)</option>
                <option value="Colonia Victoria">Colonia Victoria (RN 12)</option>
                <option value="Paraje Fachinal">Paraje Fachinal (RN 105)</option>
                <option value="Ituzaingó">Ituzaingó (RN 12)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">2. Serial Desde (Inicial) *</label>
              <div className="relative">
                <input
                  type="text"
                  value={serialDesde}
                  onChange={(e) => setSerialDesde(e.target.value)}
                  placeholder="ej. 100001 o TAG-001"
                  className="w-full p-2.5 pr-8 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
                  required
                />
                <Hash className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">3. Serial Hasta (Final) *</label>
              <div className="relative">
                <input
                  type="text"
                  value={serialHasta}
                  onChange={(e) => setSerialHasta(e.target.value)}
                  placeholder="ej. 100500 o TAG-500"
                  className="w-full p-2.5 pr-8 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
                  required
                />
                <Hash className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">Cantidad de Unidades</label>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-100 font-bold text-cs-primary text-xs flex items-center justify-between">
                <span>{cantidadCalculada} TAGs</span>
                <span className="text-[10px] font-normal text-slate-500">Calculado</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Observaciones / Nº de Remito (Opcional)</label>
            <div className="relative">
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="ej. Remito #84920 - Proveedor RFID TelePASE"
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
            <h3 className="font-bold text-base text-slate-900">Lotes de TAGs Habilitados por Estación</h3>
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
                <th className="p-3">Fecha Alta</th>
                <th className="p-3">Estación</th>
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
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No se han registrado lotes de recepción de TAGs aún.
                  </td>
                </tr>
              ) : (
                batches.map((b, idx) => (
                  <tr key={b.id || idx} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {b.created_at ? new Date(b.created_at).toLocaleString('es-AR') : '-'}
                    </td>
                    <td className="p-3 font-bold text-slate-800 whitespace-nowrap">{b.estacion}</td>
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
