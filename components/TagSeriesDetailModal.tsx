'use client';

import React, { useState, useMemo } from 'react';
import { TagBatch, TagTransfer, TagDelivery } from '@/types/database';
import { getAllBatches, getAllTransfers, getAllDeliveries } from '@/lib/inventoryValidation';
import { Layers, Search, X, CheckCircle2, AlertCircle, MapPin, Hash, Truck, ShieldCheck, Tag, Info } from 'lucide-react';

interface TagSeriesDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStation?: string;
  availableStations: string[];
}

export interface TagRangeItem {
  id: string;
  estacion: string;
  serialDesde: string;
  serialHasta: string;
  cantidadTotal: number;
  tipo: 'Lote Inicial' | 'Transferencia Recibida' | 'Transferencia Pendiente';
  origen: string;
  numeroRemito?: string;
  entregadosCount: number;
  disponiblesCount: number;
  primerDisponible?: string;
}

export default function TagSeriesDetailModal({
  isOpen,
  onClose,
  initialStation = 'Todas',
  availableStations,
}: TagSeriesDetailModalProps) {
  const [selectedStation, setSelectedStation] = useState<string>(initialStation);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Actualizar estación seleccionada al abrir modal
  React.useEffect(() => {
    setSelectedStation(initialStation);
  }, [initialStation, isOpen]);

  // Cargar todos los rangos (Lotes + Transferencias) y calcular stock exacto por rango
  const { rangeItems, individualSearchResult } = useMemo(() => {
    const allBatches: TagBatch[] = getAllBatches();
    const allTransfers: TagTransfer[] = getAllTransfers();
    const allDeliveries: TagDelivery[] = getAllDeliveries();

    const items: TagRangeItem[] = [];

    // 1. Agregar Rangos de Lotes Iniciales
    allBatches.forEach((b) => {
      if (!b) return;
      const st = b.estacion || 'Oficina Central';

      // Filtrar entregas que caen dentro de este rango y estación
      const numDesde = parseInt(b.serial_desde.replace(/\D/g, ''), 10);
      const numHasta = parseInt(b.serial_hasta.replace(/\D/g, ''), 10);

      const entregadosEnRango = allDeliveries.filter((d) => {
        if (!d || !d.tag_serial) return false;
        const numSerial = parseInt(d.tag_serial.replace(/\D/g, ''), 10);
        if (isNaN(numSerial) || isNaN(numDesde) || isNaN(numHasta)) return false;
        return (
          d.estacion?.trim().toLowerCase() === st.trim().toLowerCase() &&
          numSerial >= numDesde &&
          numSerial <= numHasta
        );
      }).length;

      // Transferencias enviadas desde esta estación en este rango
      const transferidosFuera = allTransfers
        .filter(
          (t) =>
            t &&
            t.origen?.trim().toLowerCase() === st.trim().toLowerCase() &&
            t.estado !== 'Cancelado' &&
            t.serial_desde === b.serial_desde
        )
        .reduce((acc, t) => acc + (t.cantidad || 0), 0);

      const disp = Math.max(0, b.cantidad - entregadosEnRango - transferidosFuera);

      items.push({
        id: b.id || `batch-${b.serial_desde}`,
        estacion: st,
        serialDesde: b.serial_desde,
        serialHasta: b.serial_hasta,
        cantidadTotal: b.cantidad,
        tipo: 'Lote Inicial',
        origen: 'Alta de Lotes',
        numeroRemito: b.numero_remito,
        entregadosCount: entregadosEnRango + transferidosFuera,
        disponiblesCount: disp,
      });
    });

    // 2. Agregar Rangos de Transferencias Recibidas
    allTransfers.forEach((t) => {
      if (!t) return;
      const st = t.destino;
      const esRecibido = t.estado === 'Recibido';

      const numDesde = parseInt(t.serial_desde.replace(/\D/g, ''), 10);
      const numHasta = parseInt(t.serial_hasta.replace(/\D/g, ''), 10);

      const entregadosEnRango = allDeliveries.filter((d) => {
        if (!d || !d.tag_serial) return false;
        const numSerial = parseInt(d.tag_serial.replace(/\D/g, ''), 10);
        if (isNaN(numSerial) || isNaN(numDesde) || isNaN(numHasta)) return false;
        return (
          d.estacion?.trim().toLowerCase() === st.trim().toLowerCase() &&
          numSerial >= numDesde &&
          numSerial <= numHasta
        );
      }).length;

      const disp = esRecibido ? Math.max(0, t.cantidad - entregadosEnRango) : 0;

      items.push({
        id: t.id || `tr-${t.serial_desde}`,
        estacion: st,
        serialDesde: t.serial_desde,
        serialHasta: t.serial_hasta,
        cantidadTotal: t.cantidad,
        tipo: esRecibido ? 'Transferencia Recibida' : 'Transferencia Pendiente',
        origen: `Enviado desde ${t.origen}`,
        numeroRemito: t.fecha_envio ? `Mov. ${t.fecha_envio}` : undefined,
        entregadosCount: entregadosEnRango,
        disponiblesCount: disp,
      });
    });

    // 3. Resultado de Búsqueda Individual Directa de Serie
    let searchRes: {
      found: boolean;
      serial: string;
      estacion?: string;
      estado?: string;
      rango?: string;
      detalle?: string;
    } | null = null;

    const termClean = searchTerm.trim().toUpperCase();
    if (termClean.length >= 4) {
      const numSearch = parseInt(termClean.replace(/\D/g, ''), 10);

      // Buscar si ya fue entregado
      const entregado = allDeliveries.find((d) => d.tag_serial.trim().toUpperCase() === termClean);
      if (entregado) {
        searchRes = {
          found: true,
          serial: termClean,
          estacion: entregado.estacion,
          estado: 'Entregado a Vehículo',
          rango: '-',
          detalle: `Entregado el ${new Date(entregado.created_at || '').toLocaleDateString('es-AR')} a Dominio: ${entregado.dominio} (DNI/CUIT: ${entregado.dni_cuit})`,
        };
      } else {
        // Buscar en qué estación reside actualmente este TAG por Lote o Transferencia
        const itemCoincidente = items.find((it) => {
          const nD = parseInt(it.serialDesde.replace(/\D/g, ''), 10);
          const nH = parseInt(it.serialHasta.replace(/\D/g, ''), 10);
          return numSearch >= nD && numSearch <= nH;
        });

        if (itemCoincidente) {
          searchRes = {
            found: true,
            serial: termClean,
            estacion: itemCoincidente.estacion,
            estado: itemCoincidente.tipo === 'Transferencia Pendiente' ? 'Pendiente Recepción' : 'Disponible en Stock',
            rango: `${itemCoincidente.serialDesde} al ${itemCoincidente.serialHasta}`,
            detalle: `Stock en ${itemCoincidente.estacion} (${itemCoincidente.tipo})`,
          };
        } else {
          searchRes = {
            found: false,
            serial: termClean,
            estado: 'No registrado',
            detalle: 'El número de TAG ingresado no figura en los lotes dados de alta ni en las transferencias registradas.',
          };
        }
      }
    }

    return { rangeItems: items, individualSearchResult: searchRes };
  }, [searchTerm]);

  // Filtrado por Punto de Entrega y por término de búsqueda
  const filteredItems = rangeItems.filter((item) => {
    const matchesStation = selectedStation === 'Todas' || item.estacion.trim().toLowerCase() === selectedStation.trim().toLowerCase();
    const term = searchTerm.trim().toLowerCase();
    const matchesTerm =
      !term ||
      item.serialDesde.toLowerCase().includes(term) ||
      item.serialHasta.toLowerCase().includes(term) ||
      item.estacion.toLowerCase().includes(term) ||
      item.origen.toLowerCase().includes(term);

    return matchesStation && matchesTerm;
  });

  const totalStockFiltrado = filteredItems.reduce((acc, it) => acc + it.disponiblesCount, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera del Modal */}
        <div className="bg-cs-primary text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Layers className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-bold">Detalle de Inventario y Series de TAGs</h2>
              <p className="text-xs text-emerald-100">
                Consulta completa de rangos asignados, disponibilidad y ubicación por Punto de Entrega
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros y Buscador */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Selector de Estaciones */}
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-cs-primary flex-shrink-0" />
              <label className="text-xs font-bold text-slate-700">Punto de Entrega:</label>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="p-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-cs-primary focus:outline-none"
              >
                <option value="Todas">Todas las Estaciones (Vista Global)</option>
                {availableStations.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Buscador de Serie o Rango */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar Nº de Serie individual o Rango (ej. 63230000)..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Resultado de Búsqueda Individual en Tiempo Real */}
          {individualSearchResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                !individualSearchResult.found
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : individualSearchResult.estado === 'Entregado a Vehículo'
                  ? 'bg-sky-50 border-sky-200 text-sky-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 flex-shrink-0" />
                <div>
                  <span className="font-bold">TAG {individualSearchResult.serial}:</span>{' '}
                  <span className="font-black uppercase">{individualSearchResult.estado}</span>
                  {individualSearchResult.estacion && (
                    <span className="ml-2 bg-white/80 px-2 py-0.5 rounded font-bold border">
                      Ubicación: {individualSearchResult.estacion}
                    </span>
                  )}
                  <p className="text-[11px] opacity-90 mt-0.5">{individualSearchResult.detalle}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contenido Principal: Grilla de Rangos */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Mostrando <b>{filteredItems.length}</b> rangos de series en inventario
            </span>
            <span className="text-xs bg-emerald-100 text-emerald-900 font-extrabold px-2.5 py-1 rounded-lg border border-emerald-300">
              Total Disponible Filtrado: <b>{totalStockFiltrado.toLocaleString('es-AR')} TAGs</b>
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No se encontraron rangos de series de TAGs para los criterios seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Punto de Entrega</th>
                    <th className="p-3">Serie Desde</th>
                    <th className="p-3">Serie Hasta</th>
                    <th className="p-3 text-center">Cant. Rango</th>
                    <th className="p-3 text-center">Disponibles</th>
                    <th className="p-3">Origen / Origen Lote</th>
                    <th className="p-3 text-center">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-bold text-slate-900 flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-cs-primary flex-shrink-0" />
                        <span>{item.estacion}</span>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-800">{item.serialDesde}</td>
                      <td className="p-3 font-mono font-bold text-emerald-800">{item.serialHasta}</td>
                      <td className="p-3 text-center font-bold">{item.cantidadTotal.toLocaleString('es-AR')} u.</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-black text-[11px] ${
                            item.disponiblesCount > 0
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {item.disponiblesCount.toLocaleString('es-AR')} disp.
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">
                        <div className="flex flex-col">
                          <span className="font-semibold">{item.origen}</span>
                          {item.numeroRemito && (
                            <span className="text-[10px] text-slate-400">Remito: {item.numeroRemito}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            item.tipo === 'Lote Inicial'
                              ? 'bg-sky-100 text-sky-800 border border-sky-300'
                              : item.tipo === 'Transferencia Recibida'
                              ? 'bg-teal-100 text-teal-800 border border-teal-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {item.tipo}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1 text-slate-600">
            <Info className="w-4 h-4 text-cs-primary flex-shrink-0" />
            <span>
              Para entregar TAGs individualmente o en bloque, utilice el formulario principal en la pestaña <b>Entregas</b>.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cs-primary hover:bg-emerald-950 text-white font-bold rounded-xl shadow-xs transition"
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
}
