'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TagDelivery, UserSession, TagBatch, PeajeStock } from '@/types/database';
import { getMasterDeliveryPoints } from '@/lib/deliveryPoints';
import { CheckCircle2, AlertCircle, Save, Car, User } from 'lucide-react';

interface DeliveryFormProps {
  currentUser: UserSession;
  onDeliverySuccess: () => void;
}

export default function DeliveryForm({ currentUser, onDeliverySuccess }: DeliveryFormProps) {
  const defaultStation = currentUser.punto_entrega && currentUser.punto_entrega !== 'Todos'
    ? currentUser.punto_entrega
    : 'Santa Ana';

  const [formData, setFormData] = useState<TagDelivery>({
    estacion: defaultStation,
    nombre_apellido: '',
    dni_cuit: '',
    dominio: '',
    tag_serial: '',
    operador_runner: currentUser.nombre || currentUser.email,
    observaciones: '',
  });

  const [deliveryPoints, setDeliveryPoints] = useState<string[]>([
    'Santa Ana',
    'Colonia Victoria',
    'Paraje Fachinal',
    'Ituzaingó',
  ]);

  useEffect(() => {
    const loadPoints = async () => {
      const masterList = await getMasterDeliveryPoints();
      const names = masterList.map((p) => p.estacion);
      setDeliveryPoints(names);

      const assignedPoint = currentUser.punto_entrega && currentUser.punto_entrega !== 'Todos'
        ? currentUser.punto_entrega
        : names[0] || 'Santa Ana';
      
      setFormData((prev) => ({ ...prev, estacion: assignedPoint }));
    };

    loadPoints();

    const handleUpdated = () => loadPoints();
    window.addEventListener('delivery_points_updated', handleUpdated);
    return () => window.removeEventListener('delivery_points_updated', handleUpdated);
  }, [currentUser]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'dominio' ? value.toUpperCase().replace(/\s/g, '') : value,
    }));
  };

  // Función de validación de Lotes Habilitados por Estación
  const isTagInEnabledBatch = (serial: string, stationName: string): boolean => {
    const stored = localStorage.getItem('telepase_local_tag_batches');
    if (!stored) return true;

    try {
      const batches: TagBatch[] = JSON.parse(stored);
      const stationBatches = batches.filter((b) => b.estacion === stationName);
      if (stationBatches.length === 0) return true;

      const serialNum = parseInt(serial.replace(/\D/g, ''), 10);

      return stationBatches.some((b) => {
        const numDesde = parseInt(b.serial_desde.replace(/\D/g, ''), 10);
        const numHasta = parseInt(b.serial_hasta.replace(/\D/g, ''), 10);

        if (!isNaN(serialNum) && !isNaN(numDesde) && !isNaN(numHasta)) {
          return serialNum >= numDesde && serialNum <= numHasta;
        }

        return serial >= b.serial_desde && serial <= b.serial_hasta;
      });
    } catch {
      return true;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const tagClean = formData.tag_serial.trim().toUpperCase();

    // Campos estrictamente obligatorios: Dominio, DNI/CUIT, TAG Serial y Estación
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

    // 1. Validar que el TAG pertenezca a un lote habilitado para este Punto de Entrega
    const habilitado = isTagInEnabledBatch(tagClean, formData.estacion);
    if (!habilitado) {
      setMessage({
        type: 'error',
        text: `El TAG "${tagClean}" NO pertenece a ningún lote dado de alta para el Punto de Entrega ${formData.estacion}. Verifique el número o registre el lote en Configuración.`,
      });
      setLoading(false);
      return;
    }

    // 2. Validar si ya fue entregado previamente en local
    const storedDeliveries = localStorage.getItem('telepase_local_tag_deliveries');
    const existingList: TagDelivery[] = storedDeliveries ? JSON.parse(storedDeliveries) : [];
    const yaEntregado = existingList.some((d) => d.tag_serial.toUpperCase() === tagClean);
    if (yaEntregado) {
      setMessage({ type: 'error', text: `El número de TAG "${tagClean}" ya fue entregado previamente.` });
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

    // Guardar en almacenamiento local para asegurar que aparezca DE INMEDIATO en la lista
    const updatedDeliveries = [payload, ...existingList];
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

  const isPointLocked =
    currentUser.rol === 'Operador' &&
    !!currentUser.punto_entrega &&
    currentUser.punto_entrega !== 'Todos';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      {/* Header del Formulario con Operador Activo */}
      <div className="bg-cs-dark text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Car className="w-5 h-5 text-cs-accent" />
          <h2 className="font-bold text-base">Registro de Entrega en Vía</h2>
        </div>
        <div className="flex items-center space-x-1.5 text-xs bg-white/10 text-emerald-200 px-3 py-1 rounded-full border border-white/15">
          <User className="w-3.5 h-3.5 text-cs-accent" />
          <span className="font-semibold">{currentUser.nombre}</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Mensajes de notificación */}
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full p-3 rounded-xl border-2 border-cs-primary/60 font-mono font-bold text-cs-dark tracking-wider bg-cs-primary/5 focus:ring-2 focus:ring-cs-primary focus:outline-none uppercase"
                required
              />
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
            disabled={loading}
            className="w-full py-4 bg-cs-primary hover:bg-cs-dark active:bg-cs-dark/90 text-white font-bold text-base rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            <span>{loading ? 'Registrando en Vía...' : 'GUARDAR Y REGISTRAR ENTREGA'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
