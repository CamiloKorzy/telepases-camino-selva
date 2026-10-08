'use client';

import React, { useState, useEffect } from 'react';
import { PeajeStock } from '@/types/database';
import { getMasterDeliveryPoints, saveMasterDeliveryPoint } from '@/lib/deliveryPoints';
import { MapPin, Plus, Save, AlertCircle, CheckCircle, RefreshCw, Edit2, ShieldAlert } from 'lucide-react';

interface DeliveryPointManagementProps {
  onPointUpdated?: () => void;
}

export default function DeliveryPointManagement({ onPointUpdated }: DeliveryPointManagementProps) {
  const [points, setPoints] = useState<PeajeStock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [nombre, setNombre] = useState<string>('');
  const [stockRecibido, setStockRecibido] = useState<number>(1000);
  const [stockMinimo, setStockMinimo] = useState<number>(100);
  const [editingStation, setEditingStation] = useState<string | null>(null);

  // Cargar Puntos de Entrega del Maestro
  const fetchPoints = async () => {
    setLoading(true);
    const masterPoints = await getMasterDeliveryPoints();
    setPoints(masterPoints);
    setLoading(false);
  };

  useEffect(() => {
    fetchPoints();

    const handleUpdated = () => fetchPoints();
    window.addEventListener('delivery_points_updated', handleUpdated);
    return () => window.removeEventListener('delivery_points_updated', handleUpdated);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setMessage({ text: 'Por favor, ingrese un nombre de Punto de Entrega válido.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const stationName = nombre.trim();
    const existing = points.find((p) => p.estacion.toLowerCase() === stationName.toLowerCase());

    if (!editingStation && existing) {
      setMessage({ text: `El Punto de Entrega "${stationName}" ya existe en el maestro.`, type: 'error' });
      setSubmitting(false);
      return;
    }

    const newPoint: PeajeStock = {
      estacion: stationName,
      stock_recibido: Number(stockRecibido) || 0,
      stock_entregado: editingStation ? existing?.stock_entregado || 0 : 0,
      stock_minimo_alerta: Number(stockMinimo) || 100,
      updated_at: new Date().toISOString(),
    };

    const updatedPoints = await saveMasterDeliveryPoint(newPoint);
    setPoints(updatedPoints);

    setMessage({
      text: editingStation
        ? `Punto de Entrega "${stationName}" actualizado con éxito.`
        : `Nuevo Punto de Entrega "${stationName}" registrado correctamente.`,
      type: 'success',
    });

    // Reset Form
    setNombre('');
    setStockRecibido(1000);
    setStockMinimo(100);
    setEditingStation(null);
    setSubmitting(false);

    if (onPointUpdated) onPointUpdated();
  };

  const handleEdit = (p: PeajeStock) => {
    setEditingStation(p.estacion);
    setNombre(p.estacion);
    setStockRecibido(p.stock_recibido);
    setStockMinimo(p.stock_minimo_alerta);
    setMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingStation(null);
    setNombre('');
    setStockRecibido(1000);
    setStockMinimo(100);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-cs-primary" />
            <h2 className="text-lg font-bold text-slate-900">
              {editingStation ? 'Editar Punto de Entrega' : 'Alta de Puntos de Entrega'}
            </h2>
          </div>
          <button
            onClick={fetchPoints}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title="Recargar Puntos de Entrega del Maestro"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cs-primary' : ''}`} />
          </button>
        </div>

        {message && (
          <div
            className={`p-4 rounded-xl flex items-center space-x-2 text-sm font-medium mb-4 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Nombre del Punto de Entrega *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Posadas Central, Santa Ana..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cs-primary font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Stock Recibido Inicial *
            </label>
            <input
              type="number"
              min="0"
              required
              placeholder="Ej: 1000"
              value={stockRecibido}
              onChange={(e) => setStockRecibido(Number(e.target.value))}
              className="w-full p-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cs-primary font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Alerta Stock Mínimo *
            </label>
            <input
              type="number"
              min="0"
              required
              placeholder="Ej: 100"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(Number(e.target.value))}
              className="w-full p-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cs-primary font-mono"
            />
          </div>

          <div className="md:col-span-3 flex justify-end space-x-3 pt-2">
            {editingStation && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-cs-primary hover:bg-cs-dark text-white text-xs font-bold rounded-xl flex items-center space-x-2 shadow-sm transition disabled:opacity-50"
            >
              {editingStation ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingStation ? 'Guardar Cambios' : 'Guardar Punto de Entrega'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Tabla de Puntos de Entrega Registrados en el Maestro */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-cs-primary" />
          <span>Maestro de Puntos de Entrega Registrados ({points.length})</span>
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-cs-dark text-white">
              <tr>
                <th className="p-3">Punto de Entrega</th>
                <th className="p-3">Stock Recibido</th>
                <th className="p-3">Stock Entregado</th>
                <th className="p-3">Stock Disponible</th>
                <th className="p-3">Alerta Mínima</th>
                <th className="p-3">Estado Stock</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {points.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No hay Puntos de Entrega registrados en el Maestro.
                  </td>
                </tr>
              ) : (
                points.map((p) => {
                  const disponible = p.stock_recibido - p.stock_entregado;
                  const alerta = disponible <= p.stock_minimo_alerta;

                  return (
                    <tr key={p.estacion} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-900 text-sm">{p.estacion}</td>
                      <td className="p-3 font-mono font-semibold text-slate-800">{p.stock_recibido}</td>
                      <td className="p-3 font-mono font-semibold text-emerald-800">{p.stock_entregado}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 text-sm">{disponible}</td>
                      <td className="p-3 font-mono text-slate-500">{p.stock_minimo_alerta}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            alerta
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {alerta ? (
                            <>
                              <ShieldAlert className="w-3 h-3 mr-1 text-rose-600" />
                              Stock Bajo
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                              Normal
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleEdit(p)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition inline-flex items-center space-x-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
