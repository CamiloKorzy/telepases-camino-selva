'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { TagDelivery, UserSession, TagBatch, PeajeStock } from '@/types/database';
import { QrCode, CheckCircle2, AlertCircle, Save, Car, Camera, CameraOff, Zap, User } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface DeliveryFormProps {
  currentUser: UserSession;
  onDeliverySuccess: () => void;
}

export default function DeliveryForm({ currentUser, onDeliverySuccess }: DeliveryFormProps) {
  const [formData, setFormData] = useState<TagDelivery>({
    estacion: 'Santa Ana',
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
    // Cargar Puntos de Entrega dinámicos
    const loadPoints = async () => {
      let points: string[] = [];
      const stored = localStorage.getItem('telepase_local_delivery_points');
      if (stored) {
        try {
          const list: PeajeStock[] = JSON.parse(stored);
          if (list.length > 0) points = list.map((p) => p.estacion);
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
        setFormData((prev) => ({ ...prev, estacion: prev.estacion || points[0] }));
      }
    };

    loadPoints();
  }, []);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedTag, setLastScannedTag] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const dniInputRef = useRef<HTMLInputElement | null>(null);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Ignorar si el navegador restringe audio
    }
  };

  useEffect(() => {
    let html5Qrcode: Html5Qrcode | null = null;

    if (isScanning) {
      setCameraError(null);
      html5Qrcode = new Html5Qrcode('reader');
      scannerRef.current = html5Qrcode;

      const config = {
        fps: 10,
        qrbox: { width: 260, height: 160 },
        aspectRatio: 1.333333,
      };

      html5Qrcode
        .start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            const serialLimpio = decodedText.trim().toUpperCase();
            setFormData((prev) => ({ ...prev, tag_serial: serialLimpio }));
            setLastScannedTag(serialLimpio);
            playBeep();

            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(200);
            }

            if (html5Qrcode && html5Qrcode.isScanning) {
              html5Qrcode
                .stop()
                .then(() => {
                  setIsScanning(false);
                  setTimeout(() => {
                    dniInputRef.current?.focus();
                  }, 100);
                })
                .catch(() => setIsScanning(false));
            } else {
              setIsScanning(false);
            }
          },
          () => {}
        )
        .catch((err) => {
          console.error('Error iniciando cámara:', err);
          setCameraError('No se pudo acceder a la cámara. Permita el acceso en su navegador.');
          setIsScanning(false);
        });
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isScanning]);

  const toggleScanner = () => {
    setIsScanning((prev) => !prev);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'dominio' ? value.toUpperCase().replace(/\s/g, '') : value,
    }));
  };

  // Función de validación de Lotes Habilitados por Estación
  const isTagInEnabledBatch = (serial: string, stationName: string): boolean => {
    // 1. Obtener lotes desde localStorage y Supabase
    const stored = localStorage.getItem('telepase_local_tag_batches');
    if (!stored) return true; // Si aún no se registran lotes, se permite para flexibilidad inicial

    try {
      const batches: TagBatch[] = JSON.parse(stored);
      const stationBatches = batches.filter((b) => b.estacion === stationName);
      if (stationBatches.length === 0) return true; // Si la estación no tiene lotes cargados aún

      const serialNum = parseInt(serial.replace(/\D/g, ''), 10);

      // Verificar si el TAG cae dentro de alguno de los lotes habilitados
      return stationBatches.some((b) => {
        const numDesde = parseInt(b.serial_desde.replace(/\D/g, ''), 10);
        const numHasta = parseInt(b.serial_hasta.replace(/\D/g, ''), 10);

        if (!isNaN(serialNum) && !isNaN(numDesde) && !isNaN(numHasta)) {
          return serialNum >= numDesde && serialNum <= numHasta;
        }

        // Comparación alfanumérica fallback
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
    setLastScannedTag(null);
    
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
        {/* ESCÁNER DE CÁMARA */}
        <div className="bg-cs-dark text-white p-4 rounded-2xl border border-cs-primary/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Camera className="w-5 h-5 text-cs-accent" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200">Escáner de TAG RFID</span>
            </div>
            <button
              type="button"
              onClick={toggleScanner}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                isScanning
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-cs-accent hover:bg-cs-light text-cs-dark shadow-md'
              }`}
            >
              {isScanning ? (
                <>
                  <CameraOff className="w-4 h-4" />
                  <span>Cerrar Cámara</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>ABRIR CÁMARA</span>
                </>
              )}
            </button>
          </div>

          {/* Visor de la cámara */}
          {isScanning && (
            <div className="relative rounded-xl overflow-hidden bg-black border-2 border-cs-accent">
              <div id="reader" className="w-full max-h-72"></div>
              <div className="p-2 text-center bg-cs-dark/90 text-emerald-300 text-xs font-medium border-t border-cs-primary/40">
                Apunta la cámara al código de barras o QR del TAG
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {lastScannedTag && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 rounded-xl flex items-center justify-between text-xs font-bold animate-pulse">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>TAG Capturado: <span className="font-mono text-white text-sm">{lastScannedTag}</span></span>
              </div>
              <span className="text-[10px] bg-emerald-800/60 text-emerald-200 px-2 py-0.5 rounded-full uppercase">Lector OK</span>
            </div>
          )}
        </div>

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
                className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-slate-800 focus:ring-2 focus:ring-cs-primary focus:outline-none"
              >
                {deliveryPoints.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            {/* Nº Serie TAG RFID */}
            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">2. Nº Serie TAG RFID *</label>
              <div className="relative">
                <input
                  type="text"
                  name="tag_serial"
                  value={formData.tag_serial}
                  onChange={handleChange}
                  placeholder="Escanear con cámara o ingresar"
                  className="w-full p-3 pr-10 rounded-xl border-2 border-cs-primary/60 font-mono font-bold text-cs-dark tracking-wider bg-cs-primary/5 focus:ring-2 focus:ring-cs-primary focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={toggleScanner}
                  className="absolute right-2 top-2.5 p-1 bg-cs-primary text-white rounded-lg hover:bg-cs-dark transition"
                  title="Abrir Cámara Escáner"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
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
                ref={dniInputRef}
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
