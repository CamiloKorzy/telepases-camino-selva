'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TagDelivery, UserSession } from '@/types/database';
import { getMasterDeliveryPoints } from '@/lib/deliveryPoints';
import { validateTagDelivery, refreshInventoryCache, getFirstAvailableTagForStation } from '@/lib/inventoryValidation';
import { logUserAction } from '@/lib/auditLogger';
import { CheckCircle2, AlertCircle, Car, User, Truck, Copy, RefreshCw, Hash, Zap } from 'lucide-react';

interface DeliveryFormProps {
  currentUser: UserSession;
  onDeliverySuccess: () => void;
}

interface DeliveryRow {
  id: string;
  tagSerial: string;
  dominio: string;
  dniCuit: string;
  nombre: string;
}

export default function DeliveryForm({ currentUser, onDeliverySuccess }: DeliveryFormProps) {
  const defaultStation = currentUser.punto_entrega && currentUser.punto_entrega !== 'Todos'
    ? currentUser.punto_entrega
    : 'Santa Ana';

  // Configuración Unificada de Entrega (Default: 1 TAG)
  const [station, setStation] = useState<string>(defaultStation);
  const [startSerial, setStartSerial] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1); // DEFAULT ES 1 TAG
  const [rows, setRows] = useState<DeliveryRow[]>([]);

  const [deliveryPoints, setDeliveryPoints] = useState<string[]>([
    'Santa Ana',
    'Colonia Victoria',
    'Paraje Fachinal',
    'Ituzaingó',
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cargar Puntos de Entrega y auto-sugerir primer disponible
  useEffect(() => {
    const loadPoints = async () => {
      await refreshInventoryCache();
      const masterList = await getMasterDeliveryPoints();
      const names = masterList.map((p) => p.estacion);
      setDeliveryPoints(names);

      const assignedPoint = currentUser.punto_entrega && currentUser.punto_entrega !== 'Todos'
        ? currentUser.punto_entrega
        : names[0] || 'Santa Ana';

      setStation(assignedPoint);
      const suggestedTag = getFirstAvailableTagForStation(assignedPoint);
      setStartSerial(suggestedTag || '');
    };

    loadPoints();

    const handleUpdated = () => loadPoints();
    window.addEventListener('delivery_points_updated', handleUpdated);
    return () => window.removeEventListener('delivery_points_updated', handleUpdated);
  }, [currentUser]);

  // Actualizar primer disponible cuando cambia la estación seleccionada
  useEffect(() => {
    const suggested = getFirstAvailableTagForStation(station);
    if (suggested) {
      setStartSerial(suggested);
    }
  }, [station]);

  // Generación dinámica de filas según Serial Inicial y Cantidad (Default: 1 fila)
  useEffect(() => {
    const cleanStart = startSerial.trim().toUpperCase();
    const count = Math.max(1, Math.min(quantity || 1, 100));

    if (!cleanStart) {
      setRows([]);
      return;
    }

    const numMatch = cleanStart.match(/\d+/);
    if (!numMatch) {
      setRows(
        Array.from({ length: count }, (_, i) => ({
          id: String(i + 1),
          tagSerial: `${cleanStart}-${i + 1}`,
          dominio: rows[i]?.dominio || '',
          dniCuit: rows[i]?.dniCuit || '',
          nombre: rows[i]?.nombre || '',
        }))
      );
      return;
    }

    const numStr = numMatch[0];
    const prefix = cleanStart.substring(0, cleanStart.indexOf(numStr));
    const padLen = numStr.length;
    const startNum = parseInt(numStr, 10);

    const newRows: DeliveryRow[] = [];
    let currentNum = startNum;
    let foundCount = 0;
    let iterations = 0;
    const maxIterations = count * 10 + 100;

    while (foundCount < count && iterations < maxIterations) {
      const serialFormatted = `${prefix}${String(currentNum).padStart(padLen, '0')}`;
      const val = validateTagDelivery(station, serialFormatted);

      if (val.valid) {
        const existingIdx = foundCount;
        newRows.push({
          id: String(foundCount + 1),
          tagSerial: serialFormatted,
          dominio: rows[existingIdx]?.dominio || '',
          dniCuit: rows[existingIdx]?.dniCuit || '',
          nombre: rows[existingIdx]?.nombre || '',
        });
        foundCount++;
      }
      currentNum++;
      iterations++;
    }

    if (foundCount < count) {
      for (let i = foundCount; i < count; i++) {
        const fallbackNum = startNum + i;
        const serialFormatted = `${prefix}${String(fallbackNum).padStart(padLen, '0')}`;
        newRows.push({
          id: String(i + 1),
          tagSerial: serialFormatted,
          dominio: rows[i]?.dominio || '',
          dniCuit: rows[i]?.dniCuit || '',
          nombre: rows[i]?.nombre || '',
        });
      }
    }

    setRows(newRows);
  }, [startSerial, quantity, station]);

  const handleRowChange = (id: string, field: keyof DeliveryRow, val: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        let finalVal = val;
        if (field === 'dominio') finalVal = val.toUpperCase().replace(/\s/g, '');
        if (field === 'tagSerial') finalVal = val.toUpperCase().trim();
        return { ...r, [field]: finalVal };
      })
    );
  };

  // Replicar DNI y Nombre de la Fila 1 a todas las demás filas
  const handleReplicateFirstRow = () => {
    if (rows.length < 2) return;
    const firstDni = rows[0]?.dniCuit.trim();
    const firstNombre = rows[0]?.nombre.trim();

    setRows((prev) =>
      prev.map((r, idx) =>
        idx === 0
          ? r
          : {
              ...r,
              dniCuit: firstDni || r.dniCuit,
              nombre: firstNombre || r.nombre,
            }
      )
    );
  };

  // Replicar DNI/CUIT de la Fila 1 a todas
  const handleReplicateDni = () => {
    if (rows.length < 2) return;
    const firstDni = rows[0]?.dniCuit.trim();
    if (!firstDni) return;
    setRows((prev) => prev.map((r) => ({ ...r, dniCuit: firstDni })));
  };

  // Replicar Nombre de la Fila 1 a todas
  const handleReplicateNombre = () => {
    if (rows.length < 2) return;
    const firstNombre = rows[0]?.nombre.trim();
    if (!firstNombre) return;
    setRows((prev) => prev.map((r) => ({ ...r, nombre: firstNombre })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!startSerial.trim()) {
      setMessage({ type: 'error', text: 'Debe ingresar o seleccionar el Número de Serie TAG RFID.' });
      setLoading(false);
      return;
    }

    if (rows.length === 0) {
      setMessage({ type: 'error', text: 'No hay filas de vehículos para registrar la entrega.' });
      setLoading(false);
      return;
    }

    // Validar que cada fila tenga Dominio y DNI/CUIT cargados
    const invalidRow = rows.find((r) => !r.dominio.trim() || !r.dniCuit.trim());
    if (invalidRow) {
      setMessage({
        type: 'error',
        text: `Fila #${invalidRow.id}: Dominio / Patente y DNI / CUIT son obligatorios para guardar la entrega.`,
      });
      setLoading(false);
      return;
    }

    // Validar disponibilidad de cada TAG
    for (const r of rows) {
      const val = validateTagDelivery(station, r.tagSerial);
      if (!val.valid) {
        setMessage({ type: 'error', text: `TAG ${r.tagSerial}: ${val.error}` });
        setLoading(false);
        return;
      }
    }

    const timestamp = new Date().toISOString();
    const payloads: TagDelivery[] = rows.map((r) => ({
      id: crypto.randomUUID(),
      created_at: timestamp,
      estacion: station,
      tag_serial: r.tagSerial.toUpperCase().trim(),
      dominio: r.dominio.toUpperCase().trim(),
      dni_cuit: r.dniCuit.trim(),
      nombre_apellido: r.nombre.trim(),
      email_contacto: '',
      celular_contacto: '',
      operador_runner: currentUser.nombre || currentUser.email,
      observaciones: '',
    }));

    // Guardar en Supabase
    try {
      await supabase.from('tag_deliveries').insert(payloads);
    } catch (err: any) {
      console.warn('Error en Supabase, guardando localmente:', err);
    }

    // Guardar en LocalStorage
    const storedDeliveries = localStorage.getItem('telepase_local_tag_deliveries');
    const prevDeliveries: TagDelivery[] = storedDeliveries ? JSON.parse(storedDeliveries) : [];
    const updatedDeliveries = [...payloads, ...prevDeliveries];
    localStorage.setItem('telepase_local_tag_deliveries', JSON.stringify(updatedDeliveries));

    // Registrar en Log de Auditoría
    const accionTxt = payloads.length === 1 ? 'ENTREGA_INDIVIDUAL_TAG' : 'ENTREGA_MASIVA_TAGS';
    const detalleTxt =
      payloads.length === 1
        ? `Entrega de TAG ${payloads[0].tag_serial} a Vehículo Dominio ${payloads[0].dominio} (DNI/CUIT: ${payloads[0].dni_cuit}) en ${station}`
        : `Entrega Masiva de ${payloads.length} TAGs en ${station}`;

    logUserAction(currentUser, accionTxt, 'Entregas', detalleTxt);

    setMessage({
      type: 'success',
      text: `¡Entrega de ${payloads.length} TAG${payloads.length > 1 ? 's' : ''} registrada exitosamente en ${station}!`,
    });

    // Resetear formulario con el siguiente TAG disponible y limpiar todos los campos
    setRows([]);
    setQuantity(1); // MANTENER DEFAULT EN 1
    const nextSuggested = getFirstAvailableTagForStation(station);
    setStartSerial(nextSuggested || '');
    setLoading(false);

    onDeliverySuccess();
  };

  const startSerialValidation = startSerial.trim()
    ? validateTagDelivery(station, startSerial)
    : { valid: false, error: 'Debe ingresar un Número de Serie TAG RFID.' };

  const isFormValid =
    startSerialValidation.valid &&
    rows.length > 0 &&
    rows.every(
      (r) =>
        validateTagDelivery(station, r.tagSerial).valid &&
        r.dominio.trim().length >= 3 &&
        r.dniCuit.trim().length >= 5
    );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Encabezado del Formulario */}
      <div className="bg-cs-primary text-white p-4 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white/10 rounded-xl">
            <Car className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-base font-bold">Registro de Entrega en Vía</h2>
            <p className="text-xs text-emerald-100">
              Entrega directa de TAGs TelePASE por vehículo o flota en estación
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 text-xs">
          <User className="w-3.5 h-3.5 text-emerald-300" />
          <span className="font-bold">{currentUser.nombre || currentUser.email}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {message && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border animate-in fade-in duration-150 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-cs-primary flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* 1. CONFIGURACIÓN PRINCIPAL DE ENTREGA */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <span className="text-cs-primary font-bold text-xs uppercase tracking-wider">
              1. DATOS DE ENTREGA Y STOCK
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Configuración inicial</span>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            {/* Punto de Entrega */}
            <div className="w-full sm:w-52">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Punto de Entrega *
              </label>
              <select
                value={station}
                onChange={(e) => setStation(e.target.value)}
                disabled={currentUser.punto_entrega !== 'Todos' && !!currentUser.punto_entrega}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-cs-primary focus:outline-none disabled:bg-slate-100"
              >
                {deliveryPoints.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            {/* Primer TAG Serial */}
            <div className="w-full sm:w-44">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-cs-primary uppercase">
                  Nº Serie TAG *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const first = getFirstAvailableTagForStation(station);
                    if (first) setStartSerial(first);
                  }}
                  className="text-[10px] text-emerald-700 font-extrabold hover:underline flex items-center space-x-0.5"
                  title="Sugerir primer TAG disponible"
                >
                  <Zap className="w-3 h-3 text-emerald-600" />
                  <span>Primer Disp.</span>
                </button>
              </div>
              <input
                type="text"
                value={startSerial}
                onChange={(e) => setStartSerial(e.target.value.toUpperCase().trim())}
                placeholder="ej. 63230000"
                className={`w-full p-2 bg-white border rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-cs-primary focus:outline-none ${
                  startSerial.trim()
                    ? startSerialValidation.valid
                      ? 'border-slate-300'
                      : 'border-rose-400 bg-rose-50/30'
                    : 'border-slate-300'
                }`}
              />
              {startSerial.trim() && (
                startSerialValidation.valid ? (
                  <div className="mt-1 text-[10px] text-emerald-800 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span>Disponible en {station}</span>
                  </div>
                ) : (
                  <div className="mt-1 p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-[10px] text-rose-800 font-bold flex items-start space-x-1 leading-tight">
                    <AlertCircle className="w-3 h-3 text-rose-600 flex-shrink-0 mt-0.5" />
                    <span>{startSerialValidation.error}</span>
                  </div>
                )
              )}
            </div>

            {/* Cantidad de TAGs */}
            <div className="w-24">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Cantidad *
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 text-center focus:ring-2 focus:ring-cs-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. ASIGNACIÓN DE PATENTES / DOMINIOS Y TITULAR POR VEHÍCULO */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Hash className="w-4 h-4 text-cs-primary" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                2. ASIGNACIÓN DE PATENTES / DOMINIOS Y TITULAR
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={handleReplicateFirstRow}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-cs-primary border border-emerald-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-xs"
                  title="Replicar DNI/CUIT y Nombre de la Fila 1 a todas las demás filas"
                >
                  <Copy className="w-3.5 h-3.5 text-cs-primary" />
                  <span className="hidden sm:inline">Replicar DNI y Nombre (Fila 1 ➔ Todas)</span>
                  <span className="sm:hidden text-[10px]">Replicar Fila 1</span>
                </button>
              )}

              <span className="text-xs font-extrabold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-lg border border-emerald-300">
                {rows.length} {rows.length === 1 ? 'Unidad' : 'Unidades'}
              </span>
            </div>
          </div>

          {/* VISTA MOBILE (< md): TARJETAS APILADAS Y LEGIBLES POR VEHÍCULO */}
          <div className="block md:hidden space-y-3">
            {rows.map((row, idx) => {
              const val = validateTagDelivery(station, row.tagSerial);

              return (
                <div key={row.id} className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-cs-primary text-white text-xs font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-extrabold text-xs text-slate-900">
                        TAG: {row.tagSerial}
                      </span>
                    </div>

                    {val.valid ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300 inline-flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Disponible</span>
                      </span>
                    ) : (
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-300 inline-flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>No Disponible</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-cs-primary uppercase mb-1">
                      Dominio / Patente *
                    </label>
                    <input
                      type="text"
                      value={row.dominio}
                      onChange={(e) => handleRowChange(row.id, 'dominio', e.target.value)}
                      placeholder="ej. AA123CD"
                      className={`w-full p-3 rounded-xl font-mono font-black text-base uppercase tracking-wider focus:ring-2 focus:ring-cs-primary focus:outline-none border shadow-2xs ${
                        !row.dominio.trim()
                          ? 'bg-rose-50/70 border-rose-300 text-rose-900 placeholder:text-rose-400'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        DNI / CUIT *
                      </label>
                      {idx === 0 && rows.length > 1 && (
                        <button
                          type="button"
                          onClick={handleReplicateDni}
                          className="text-[10px] text-cs-primary hover:underline font-extrabold flex items-center space-x-0.5"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Replicar DNI</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={row.dniCuit}
                      onChange={(e) => handleRowChange(row.id, 'dniCuit', e.target.value.replace(/\D/g, ''))}
                      placeholder="ej. 30712345678"
                      className={`w-full p-2.5 rounded-xl font-mono font-bold text-sm focus:ring-2 focus:ring-cs-primary focus:outline-none border ${
                        !row.dniCuit.trim()
                          ? 'bg-rose-50/70 border-rose-300 text-rose-900 placeholder:text-rose-400'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">
                        Nombre / Razón Social
                      </label>
                      {idx === 0 && rows.length > 1 && (
                        <button
                          type="button"
                          onClick={handleReplicateNombre}
                          className="text-[10px] text-cs-primary hover:underline font-extrabold flex items-center space-x-0.5"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Replicar Nombre</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={row.nombre}
                      onChange={(e) => handleRowChange(row.id, 'nombre', e.target.value)}
                      placeholder="ej. Juan Pérez / Empresa S.R.L."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-cs-primary focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* VISTA DESKTOP (>= md): TABLA HORIZONTAL DE ALTAS */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-2.5 text-center w-10">#</th>
                  <th className="p-2.5 w-36">TAG Serial *</th>
                  <th className="p-2.5 text-center w-24">Estado Stock</th>
                  <th className="p-2.5 w-36">Dominio / Patente *</th>
                  <th className="p-2.5 w-44">
                    <div className="flex items-center justify-between">
                      <span>DNI / CUIT *</span>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={handleReplicateDni}
                          className="text-[9px] text-cs-primary hover:underline font-bold flex items-center space-x-0.5 normal-case"
                          title="Replicar DNI/CUIT de Fila 1 a todas"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>Replicar</span>
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="p-2.5">
                    <div className="flex items-center justify-between">
                      <span>Nombre / Razón Social</span>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={handleReplicateNombre}
                          className="text-[9px] text-cs-primary hover:underline font-bold flex items-center space-x-0.5 normal-case"
                          title="Replicar Nombre de Fila 1 a todas"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>Replicar</span>
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row, idx) => {
                  const val = validateTagDelivery(station, row.tagSerial);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={row.tagSerial}
                          onChange={(e) => handleRowChange(row.id, 'tagSerial', e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs text-slate-900 focus:ring-2 focus:ring-cs-primary focus:outline-none"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        {val.valid ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-emerald-300 inline-flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>OK</span>
                          </span>
                        ) : (
                          <span
                            className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-300 inline-flex items-center space-x-1"
                            title={val.error}
                          >
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>ERR</span>
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={row.dominio}
                          onChange={(e) => handleRowChange(row.id, 'dominio', e.target.value)}
                          placeholder="ej. AA123CD"
                          className={`w-full p-1.5 rounded-lg font-mono font-bold text-xs uppercase focus:ring-2 focus:ring-cs-primary focus:outline-none border ${
                            !row.dominio.trim()
                              ? 'bg-rose-50/60 border-rose-300 text-rose-800 placeholder:text-rose-400'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={row.dniCuit}
                          onChange={(e) => handleRowChange(row.id, 'dniCuit', e.target.value.replace(/\D/g, ''))}
                          placeholder="ej. 30712345678"
                          className={`w-full p-1.5 rounded-lg font-mono text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none border ${
                            !row.dniCuit.trim()
                              ? 'bg-rose-50/60 border-rose-300 text-rose-800 placeholder:text-rose-400'
                              : 'bg-white border-slate-300 text-slate-900 font-bold'
                          }`}
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={row.nombre}
                          onChange={(e) => handleRowChange(row.id, 'nombre', e.target.value)}
                          placeholder="ej. Juan Pérez / Empresa S.R.L."
                          className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-cs-primary focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* BOTÓN REGISTRAR ENTREGA */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className={`w-full py-4 px-6 rounded-xl text-xs sm:text-sm font-black tracking-wider uppercase shadow-md transition flex items-center justify-center space-x-2 ${
              isFormValid && !loading
                ? 'bg-cs-primary hover:bg-emerald-950 text-white cursor-pointer'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>REGISTRANDO ENTREGA...</span>
              </>
            ) : (
              <>
                <Truck className="w-5 h-5 text-emerald-300" />
                <span>
                  {rows.length === 1
                    ? '🚚 REGISTRAR ENTREGA DE 1 TAG'
                    : `🚚 REGISTRAR ENTREGA MASIVA DE ${rows.length} TAGS`}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
