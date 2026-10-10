'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TagDelivery, UserSession, TagBatch } from '@/types/database';
import { getMasterDeliveryPoints, fixUserName } from '@/lib/deliveryPoints';
import { validateTagDelivery, validateTagDeliveryAsync, refreshInventoryCache } from '@/lib/inventoryValidation';
import { CheckCircle2, AlertCircle, Save, Car, User, Users, Truck, Copy, Plus, RefreshCw, Hash } from 'lucide-react';

interface DeliveryFormProps {
  currentUser: UserSession;
  onDeliverySuccess: () => void;
}

interface BulkDeliveryRow {
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

  // Modo de formulario: 'individual' (1 TAG) o 'masiva' (Flotas / Empresas)
  const [mode, setMode] = useState<'individual' | 'masiva'>('individual');

  // Formulario Individual
  const [formData, setFormData] = useState<TagDelivery>({
    estacion: defaultStation,
    nombre_apellido: '',
    dni_cuit: '',
    dominio: '',
    tag_serial: '',
    operador_runner: currentUser.nombre || currentUser.email,
    observaciones: '',
  });

  // Formulario Masivo (Flotas / Empresas)
  const [bulkStation, setBulkStation] = useState<string>(defaultStation);
  const [startSerial, setStartSerial] = useState<string>('');
  const [bulkQuantity, setBulkQuantity] = useState<number>(5);
  const [sharedDniCuit, setSharedDniCuit] = useState<string>('');
  const [sharedNombre, setSharedNombre] = useState<string>('');
  const [bulkObservaciones, setBulkObservaciones] = useState<string>('');
  const [bulkRows, setBulkRows] = useState<BulkDeliveryRow[]>([]);

  const [deliveryPoints, setDeliveryPoints] = useState<string[]>([
    'Santa Ana',
    'Colonia Victoria',
    'Paraje Fachinal',
    'Ituzaingó',
  ]);

  useEffect(() => {
    const loadPoints = async () => {
      refreshInventoryCache();
      const masterList = await getMasterDeliveryPoints();
      const names = masterList.map((p) => p.estacion);
      setDeliveryPoints(names);

      const assignedPoint = currentUser.punto_entrega && currentUser.punto_entrega !== 'Todos'
        ? currentUser.punto_entrega
        : names[0] || 'Santa Ana';
      
      setFormData((prev) => ({ ...prev, estacion: assignedPoint }));
      setBulkStation(assignedPoint);
    };

    loadPoints();

    const handleUpdated = () => loadPoints();
    window.addEventListener('delivery_points_updated', handleUpdated);
    return () => window.removeEventListener('delivery_points_updated', handleUpdated);
  }, [currentUser]);

  // Generación automática de filas masivas al cambiar Serial Inicial o Cantidad
  useEffect(() => {
    if (mode !== 'masiva') return;

    const cleanStart = startSerial.trim().toUpperCase();
    const count = Math.max(1, Math.min(bulkQuantity || 1, 100));

    if (!cleanStart) {
      setBulkRows([]);
      return;
    }

    const numMatch = cleanStart.match(/\d+/);
    if (!numMatch) {
      setBulkRows(
        Array.from({ length: count }, (_, i) => ({
          id: String(i + 1),
          tagSerial: `${cleanStart}-${i + 1}`,
          dominio: bulkRows[i]?.dominio || '',
          dniCuit: bulkRows[i]?.dniCuit || sharedDniCuit,
          nombre: bulkRows[i]?.nombre || sharedNombre,
        }))
      );
      return;
    }

    const numStr = numMatch[0];
    const prefix = cleanStart.substring(0, cleanStart.indexOf(numStr));
    const padLen = numStr.length;
    const startNum = parseInt(numStr, 10);

    const newRows: BulkDeliveryRow[] = [];
    for (let i = 0; i < count; i++) {
      const currentNum = startNum + i;
      const serialFormatted = `${prefix}${String(currentNum).padStart(padLen, '0')}`;
      newRows.push({
        id: String(i + 1),
        tagSerial: serialFormatted,
        dominio: bulkRows[i]?.dominio || '',
        dniCuit: bulkRows[i]?.dniCuit || sharedDniCuit,
        nombre: bulkRows[i]?.nombre || sharedNombre,
      });
    }

    setBulkRows(newRows);
  }, [startSerial, bulkQuantity, mode]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'dominio' ? value.toUpperCase().replace(/\s/g, '') : value,
    }));
  };

  const handleBulkRowChange = (id: string, field: keyof BulkDeliveryRow, value: string) => {
    setBulkRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          [field]: field === 'dominio' ? value.toUpperCase().replace(/\s/g, '') : value,
        };
      })
    );
  };

  const replicateDniCuit = () => {
    if (!sharedDniCuit) return;
    setBulkRows((prev) => prev.map((r) => ({ ...r, dniCuit: sharedDniCuit.trim() })));
  };

  const replicateNombre = () => {
    if (!sharedNombre) return;
    setBulkRows((prev) => prev.map((r) => ({ ...r, nombre: sharedNombre.trim() })));
  };

  // Validaciones en tiempo real para modo individual y masivo
  const singleTagValidation = formData.tag_serial.trim()
    ? validateTagDelivery(formData.estacion, formData.tag_serial)
    : null;

  const bulkInvalidRowsCount = bulkRows.filter(
    (r) => r.tagSerial.trim() && !validateTagDelivery(bulkStation, r.tagSerial).valid
  ).length;

  const handleSubmitIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const tagClean = formData.tag_serial.trim().toUpperCase();

    if (!formData.estacion || deliveryPoints.length === 0) {
      setMessage({ type: 'error', text: 'Debe dar de alta al menos un Punto de Entrega en la pestaña "Puntos de Entrega" antes de registrar entregas.' });
      setLoading(false);
      return;
    }

    if (!formData.dominio || !formData.dni_cuit || !tagClean) {
      setMessage({ type: 'error', text: 'Por favor completá los datos obligatorios: Dominio, DNI/CUIT y TAG.' });
      setLoading(false);
      return;
    }

    const valRes = await validateTagDeliveryAsync(formData.estacion, tagClean);
    if (!valRes.valid) {
      setMessage({
        type: 'error',
        text: valRes.error || `El TAG "${tagClean}" no está disponible en ${formData.estacion}.`,
      });
      setLoading(false);
      return;
    }

    const payload: TagDelivery = {
      ...formData,
      tag_serial: tagClean,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      operador_runner: currentUser.nombre || currentUser.email,
    };

    try {
      const { error } = await supabase.from('tag_deliveries').insert([payload]);
      if (error) {
        if (error.code === '23505') {
          throw new Error(`El número de TAG "${tagClean}" ya fue entregado previamente.`);
        }
        console.warn('Supabase no disponible, registrando localmente:', error.message);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('ya fue entregado')) {
        setMessage({ type: 'error', text: err.message });
        setLoading(false);
        return;
      }
    }

    const storedDeliveries = localStorage.getItem('telepase_local_tag_deliveries');
    const prevDeliveries: TagDelivery[] = storedDeliveries ? JSON.parse(storedDeliveries) : [];
    const updatedDeliveries = [payload, ...prevDeliveries];
    localStorage.setItem('telepase_local_tag_deliveries', JSON.stringify(updatedDeliveries));

    setMessage({ type: 'success', text: `¡TAG ${tagClean} registrado exitosamente para ${formData.dominio}!` });
    
    setFormData((prev) => ({
      ...prev,
      nombre_apellido: '',
      dni_cuit: '',
      dominio: '',
      tag_serial: '',
      observaciones: '',
    }));

    setLoading(false);
    onDeliverySuccess();
  };

  const handleSubmitMasivo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (bulkRows.length === 0) {
      setMessage({ type: 'error', text: 'Debe ingresar un primer número de TAG válido y una cantidad mayor a 0.' });
      setLoading(false);
      return;
    }

    // Refrescar caché de inventario antes de guardar
    await refreshInventoryCache();

    // Validar cada fila estrictamente
    const serialSet = new Set<string>();
    const payloads: TagDelivery[] = [];
    const timestamp = new Date().toISOString();

    for (let i = 0; i < bulkRows.length; i++) {
      const row = bulkRows[i];
      const serialClean = row.tagSerial.trim().toUpperCase();
      const domClean = row.dominio.trim().toUpperCase().replace(/\s/g, '');
      const dniClean = (row.dniCuit || sharedDniCuit).trim();
      const nomClean = (row.nombre || sharedNombre).trim();

      if (!serialClean) {
        setMessage({ type: 'error', text: `Fila #${i + 1}: Debe especificar el número de TAG.` });
        setLoading(false);
        return;
      }

      if (!domClean) {
        setMessage({ type: 'error', text: `Fila #${i + 1} (${serialClean}): Debe ingresar el Dominio / Patente del vehículo.` });
        setLoading(false);
        return;
      }

      if (!dniClean) {
        setMessage({ type: 'error', text: `Fila #${i + 1} (${serialClean}): Debe ingresar el DNI o CUIT.` });
        setLoading(false);
        return;
      }

      if (serialSet.has(serialClean)) {
        setMessage({ type: 'error', text: `El TAG "${serialClean}" está duplicado dentro de esta misma carga masiva.` });
        setLoading(false);
        return;
      }
      serialSet.add(serialClean);

      // Validar disponibilidad de stock en inventario
      const valRes = validateTagDelivery(bulkStation, serialClean);
      if (!valRes.valid) {
        setMessage({ type: 'error', text: `Fila #${i + 1}: ${valRes.error}` });
        setLoading(false);
        return;
      }

      payloads.push({
        id: crypto.randomUUID(),
        created_at: timestamp,
        estacion: bulkStation,
        tag_serial: serialClean,
        dominio: domClean,
        dni_cuit: dniClean,
        nombre_apellido: nomClean,
        operador_runner: currentUser.nombre || currentUser.email,
        observaciones: bulkObservaciones.trim(),
      });
    }

    // Guardar en Supabase
    try {
      await supabase.from('tag_deliveries').insert(payloads);
    } catch (err: any) {
      console.warn('Error registrando entrega masiva en Supabase:', err);
    }

    // Guardar en LocalStorage
    const storedDeliveries = localStorage.getItem('telepase_local_tag_deliveries');
    const prevDeliveries: TagDelivery[] = storedDeliveries ? JSON.parse(storedDeliveries) : [];
    const updatedDeliveries = [...payloads, ...prevDeliveries];
    localStorage.setItem('telepase_local_tag_deliveries', JSON.stringify(updatedDeliveries));

    setMessage({
      type: 'success',
      text: `¡Entrega Masiva de ${payloads.length} TAGs registrada exitosamente para ${sharedNombre || 'la flota'}!`,
    });

    // Resetear formulario masivo
    setStartSerial('');
    setBulkQuantity(5);
    setSharedDniCuit('');
    setSharedNombre('');
    setBulkObservaciones('');
    setBulkRows([]);

    setLoading(false);
    onDeliverySuccess();
  };

  const isPointLocked =
    currentUser.rol === 'Operador' &&
    !!currentUser.punto_entrega &&
    currentUser.punto_entrega !== 'Todos';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      {/* Header del Formulario y Selector de Modo */}
      <div className="bg-cs-dark text-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Car className="w-5 h-5 text-cs-accent" />
            <h2 className="font-bold text-base">Registro de Entrega en Vía</h2>
          </div>
          <div className="flex items-center space-x-1.5 text-xs bg-white/10 text-emerald-200 px-3 py-1 rounded-full border border-white/15">
            <User className="w-3.5 h-3.5 text-cs-accent" />
            <span className="font-semibold">{fixUserName(currentUser.nombre)}</span>
          </div>
        </div>

        {/* Pestañas de Modo: Individual vs Masiva */}
        <div className="flex items-center space-x-2 bg-slate-900/60 p-1 rounded-xl border border-white/10 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('individual')}
            className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center space-x-1.5 ${
              mode === 'individual'
                ? 'bg-cs-primary text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Entrega Individual (1 TAG)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('masiva')}
            className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center space-x-1.5 ${
              mode === 'masiva'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Entrega Masiva (Flotas / Empresas)</span>
            <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded uppercase">
              Nuevo
            </span>
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Mensajes de notificación */}
        {currentUser.rol === 'Consulta' && (
          <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-sky-600 flex-shrink-0" />
            <span>MODO SOLO LECTURA: Su usuario Auditor / Consulta de Inventarios no tiene permisos para registrar entregas de TAGs.</span>
          </div>
        )}

        {message && (
          <div
            className={`p-3 rounded-xl flex items-center space-x-2 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* 1. MODO ENTREGA INDIVIDUAL (1 TAG) */}
        {mode === 'individual' && (
          <form onSubmit={handleSubmitIndividual} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Punto de Entrega */}
              <div>
                <label className="block text-xs font-bold text-cs-primary uppercase mb-1">1. Punto de Entrega *</label>
                <select
                  name="estacion"
                  value={formData.estacion}
                  onChange={handleChange}
                  disabled={isPointLocked || deliveryPoints.length === 0}
                  className={`w-full p-3 rounded-xl border font-semibold text-slate-800 ${
                    isPointLocked || deliveryPoints.length === 0
                      ? 'bg-slate-100 border-slate-200 cursor-not-allowed text-slate-600'
                      : 'bg-slate-50 border-slate-300 focus:ring-2 focus:ring-cs-primary focus:outline-none'
                  }`}
                >
                  {deliveryPoints.length === 0 ? (
                    <option value="">No hay Puntos de Entrega registrados</option>
                  ) : (
                    deliveryPoints.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))
                  )}
                </select>
                {isPointLocked && (
                  <p className="text-[11px] text-amber-700 font-medium mt-1">
                    Punto de entrega fijo para su perfil de Operador.
                  </p>
                )}
              </div>

              {/* Nº Serie TAG RFID */}
              <div>
                <label className="block text-xs font-bold text-cs-primary uppercase mb-1">2. Nº Serie TAG RFID *</label>
                <input
                  type="text"
                  name="tag_serial"
                  value={formData.tag_serial}
                  onChange={handleChange}
                  placeholder="Ingresar número de serie TAG RFID"
                  className={`w-full p-3 rounded-xl border-2 font-mono font-bold tracking-wider bg-cs-primary/5 focus:ring-2 focus:outline-none uppercase ${
                    singleTagValidation
                      ? singleTagValidation.valid
                        ? 'border-emerald-500 text-emerald-950 focus:ring-emerald-500'
                        : 'border-rose-500 text-rose-950 focus:ring-rose-500'
                      : 'border-cs-primary/60 text-cs-dark focus:ring-cs-primary'
                  }`}
                  required
                />
                {singleTagValidation && (
                  <div className={`text-[11px] font-bold mt-1.5 flex items-start space-x-1 ${
                    singleTagValidation.valid ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {singleTagValidation.valid ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span>TAG disponible en stock de {formData.estacion}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                        <span>{singleTagValidation.error}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Dominio / Patente (OBLIGATORIO) */}
              <div>
                <label className="block text-xs font-bold text-cs-primary uppercase mb-1">3. Dominio / Patente *</label>
                <input
                  type="text"
                  name="dominio"
                  value={formData.dominio}
                  onChange={handleChange}
                  placeholder="AA123CD o AAA123"
                  maxLength={8}
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 tracking-wider focus:ring-2 focus:ring-cs-primary focus:outline-none uppercase"
                  required
                />
              </div>

              {/* DNI / CUIT (OBLIGATORIO) */}
              <div>
                <label className="block text-xs font-bold text-cs-primary uppercase mb-1">4. DNI / CUIT *</label>
                <input
                  type="text"
                  name="dni_cuit"
                  value={formData.dni_cuit}
                  onChange={handleChange}
                  placeholder="Sin puntos ni guiones (ej. 30123456)"
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-cs-primary focus:outline-none font-medium"
                  required
                />
              </div>
            </div>

            {/* Nombre y Apellido (Opcional) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre y Apellido Receptor (Opcional)</label>
              <input
                type="text"
                name="nombre_apellido"
                value={formData.nombre_apellido}
                onChange={handleChange}
                placeholder="Juan Pérez"
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cs-primary focus:outline-none"
              />
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Observaciones (Opcional)</label>
              <input
                type="text"
                name="observaciones"
                value={formData.observaciones}
                onChange={handleChange}
                placeholder="Ej. Vehículo Oficial, Transporte Pesado, etc."
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cs-primary focus:outline-none"
              />
            </div>

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={loading || currentUser.rol === 'Consulta' || (singleTagValidation !== null && !singleTagValidation.valid)}
              className="w-full py-4 bg-cs-primary hover:bg-cs-dark active:bg-cs-dark/90 text-white font-bold text-base rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>
                {currentUser.rol === 'Consulta'
                  ? 'SOLO LECTURA (REGISTRO DESHABILITADO)'
                  : loading
                  ? 'Registrando en Vía...'
                  : 'GUARDAR Y REGISTRAR ENTREGA'}
              </span>
            </button>
          </form>
        )}

        {/* 2. MODO ENTREGA MASIVA (FLOTAS / EMPRESAS DE TRANSPORTE) */}
        {mode === 'masiva' && (
          <form onSubmit={handleSubmitMasivo} className="space-y-4">
            {/* 1. Datos Principales de la Empresa / Flota */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center space-x-1">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>1. Configuración de Flota / Empresa</span>
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  Generación automática de series consecutivas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Punto de Entrega */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Punto de Entrega *</label>
                  <select
                    value={bulkStation}
                    onChange={(e) => setBulkStation(e.target.value)}
                    disabled={isPointLocked || deliveryPoints.length === 0}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-xs text-slate-800 bg-white"
                  >
                    {deliveryPoints.map((pt) => (
                      <option key={`blk_${pt}`} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Primer TAG Serial */}
                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">Primer Nº Serie TAG *</label>
                  <input
                    type="text"
                    value={startSerial}
                    onChange={(e) => setStartSerial(e.target.value)}
                    placeholder="ej. 63228500"
                    className={`w-full p-2.5 rounded-xl border-2 font-mono font-bold text-xs bg-white uppercase focus:ring-2 focus:outline-none ${
                      startSerial.trim()
                        ? bulkInvalidRowsCount === 0
                          ? 'border-emerald-500 text-emerald-950 focus:ring-emerald-500'
                          : 'border-rose-500 text-rose-950 focus:ring-rose-500'
                        : 'border-emerald-400 text-emerald-950 focus:ring-emerald-500'
                    }`}
                    required
                  />
                  {startSerial.trim() && (
                    <div className={`text-[10px] font-bold mt-1 flex items-center space-x-1 ${
                      bulkInvalidRowsCount === 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {bulkInvalidRowsCount === 0 ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          <span>Serie en stock ({bulkRows.length} TAGs OK)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3 text-rose-600 flex-shrink-0" />
                          <span>⛔ {bulkInvalidRowsCount} de {bulkRows.length} TAGs sin stock en {bulkStation}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Cantidad de TAGs */}
                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">Cantidad de TAGs *</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={bulkQuantity}
                    onChange={(e) => setBulkQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                {/* DNI / CUIT Empresa */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">CUIT / DNI Empresa *</label>
                    <button
                      type="button"
                      onClick={replicateDniCuit}
                      className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center space-x-0.5"
                      title="Replicar CUIT a todos los vehículos de la lista"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Replicar</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={sharedDniCuit}
                    onChange={(e) => setSharedDniCuit(e.target.value)}
                    placeholder="ej. 30712345678"
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-xs bg-white text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nombre Empresa */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">Razón Social / Empresa (Opcional)</label>
                    <button
                      type="button"
                      onClick={replicateNombre}
                      className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center space-x-0.5"
                      title="Replicar Nombre a todos los registros"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Replicar</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={sharedNombre}
                    onChange={(e) => setSharedNombre(e.target.value)}
                    placeholder="ej. Transportes Misiones S.R.L. / Línea 05"
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-xs bg-white text-slate-900"
                  />
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Observaciones Comunes (Opcional)</label>
                  <input
                    type="text"
                    value={bulkObservaciones}
                    onChange={(e) => setBulkObservaciones(e.target.value)}
                    placeholder="ej. Entrega de flota colectivos transporte urbano"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* 2. Grilla de Carga de Patentes / Dominios */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1">
                  <Hash className="w-4 h-4 text-cs-primary" />
                  <span>2. Asignación de Patentes / Dominios por Vehículo</span>
                </span>
                <span className="text-xs font-extrabold text-emerald-900 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full font-mono">
                  {bulkRows.length} Unidades
                </span>
              </div>

              {bulkRows.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 font-medium">
                  Ingrese el <b>Primer Nº Serie TAG</b> y la <b>Cantidad de TAGs</b> arriba para desplegar la grilla de asignación de patentes.
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto border border-slate-200 rounded-xl shadow-inner">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 text-center w-10">#</th>
                        <th className="p-2.5">TAG Serial *</th>
                        <th className="p-2.5">Estado Stock</th>
                        <th className="p-2.5">Dominio / Patente *</th>
                        <th className="p-2.5">DNI / CUIT *</th>
                        <th className="p-2.5">Razón Social / Receptor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {bulkRows.map((row, idx) => {
                        const rowVal = row.tagSerial.trim()
                          ? validateTagDelivery(bulkStation, row.tagSerial)
                          : null;

                        return (
                          <tr key={row.id} className={`transition ${rowVal && !rowVal.valid ? 'bg-rose-50/40' : 'hover:bg-emerald-50/30'}`}>
                            <td className="p-2.5 text-center font-mono font-extrabold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-cs-primary">
                              <input
                                type="text"
                                value={row.tagSerial}
                                onChange={(e) => handleBulkRowChange(row.id, 'tagSerial', e.target.value)}
                                className={`w-full p-1.5 rounded-lg border font-mono font-bold text-xs uppercase focus:ring-2 focus:outline-none ${
                                  rowVal
                                    ? rowVal.valid
                                      ? 'border-slate-300 text-slate-900 focus:ring-emerald-500'
                                      : 'border-rose-400 text-rose-900 bg-rose-50 focus:ring-rose-500'
                                    : 'border-slate-300 text-slate-900'
                                }`}
                                required
                              />
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              {rowVal ? (
                                rowVal.valid ? (
                                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>OK</span>
                                  </span>
                                ) : (
                                  <span
                                    title={rowVal.error}
                                    className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 cursor-help"
                                  >
                                    <AlertCircle className="w-3 h-3 text-rose-600" />
                                    <span>Sin Stock</span>
                                  </span>
                                )
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">-</span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={row.dominio}
                                onChange={(e) => handleBulkRowChange(row.id, 'dominio', e.target.value)}
                                placeholder="AA123CD"
                                maxLength={8}
                                className="w-full p-1.5 rounded-lg border-2 border-cs-primary/50 font-mono font-bold text-slate-900 text-xs uppercase bg-cs-primary/5 focus:ring-2 focus:ring-cs-primary focus:outline-none"
                                required
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={row.dniCuit}
                                onChange={(e) => handleBulkRowChange(row.id, 'dniCuit', e.target.value)}
                                placeholder="30712345678"
                                className="w-full p-1.5 rounded-lg border border-slate-300 font-medium text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                                required
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={row.nombre}
                                onChange={(e) => handleBulkRowChange(row.id, 'nombre', e.target.value)}
                                placeholder="Transportes S.R.L."
                                className="w-full p-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Botón de Guardar Entrega Masiva */}
            <button
              type="submit"
              disabled={loading || currentUser.rol === 'Consulta' || bulkRows.length === 0 || bulkInvalidRowsCount > 0}
              className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 uppercase tracking-wider"
            >
              <Truck className="w-5 h-5" />
              <span>
                {currentUser.rol === 'Consulta'
                  ? 'SOLO LECTURA (REGISTRO DESHABILITADO)'
                  : loading
                  ? 'Registrando Flota...'
                  : `🚚 GUARDAR Y REGISTRAR ENTREGA MASIVA (${bulkRows.length} TAGs)`}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
