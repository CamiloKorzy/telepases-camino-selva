'use client';

import React, { useState, useEffect } from 'react';
import { ActivationDocConfig, PeajeStock } from '@/types/database';
import { getMasterDeliveryPoints, saveMasterDeliveryPoint } from '@/lib/deliveryPoints';
import { supabase } from '@/lib/supabase';
import { FileText, Image as ImageIcon, Mail, Phone, Save, CheckCircle, AlertCircle, Upload, Trash2, Power, Eye, Copy, RefreshCw, Send } from 'lucide-react';

const LOCAL_DOC_CONFIG_KEY = 'telepase_activation_doc_config';

export function getActivationDocConfig(): ActivationDocConfig {
  const defaultConfig: ActivationDocConfig = {
    email_active: true,
    whatsapp_active: true,
    email_subject: 'Folleto de Activación e Instrucciones de Tu TAG TelePASE - Camino de la Selva',
    email_body_template: '¡Hola {NOMBRE}!\n\nTe adjuntamos el folleto explicativo e instrucciones de activación para tu nuevo TAG TelePASE (Nº {TAG}) registrado para el vehículo con dominio {DOMINIO} en la estación {ESTACION}.\n\n¡Gracias por utilizar Camino de la Selva!',
    whatsapp_body_template: '¡Hola {NOMBRE}! 🚗 Te enviamos la guía y folleto de activación de tu TAG TelePASE {TAG} (Vehículo {DOMINIO}) registrado en {ESTACION}. Accedé a la documentación aquí: {LINK_DOCUMENTO}',
  };

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LOCAL_DOC_CONFIG_KEY);
    if (stored) {
      try {
        return { ...defaultConfig, ...JSON.parse(stored) };
      } catch {}
    }
  }
  return defaultConfig;
}

export function formatWhatsAppNumber(phone: string): string {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) clean = clean.substring(1);
  if (clean.startsWith('15')) clean = clean.substring(2);
  if (!clean.startsWith('54')) clean = `549${clean}`;
  return clean;
}

export function generateWhatsAppLink(
  phone: string,
  nombre: string,
  dominio: string,
  tagSerial: string,
  estacion: string,
  docConfig?: ActivationDocConfig
): string {
  const config = docConfig || getActivationDocConfig();
  const cleanPhone = formatWhatsAppNumber(phone);
  let template = config.whatsapp_body_template || 'Hola {NOMBRE}, tu TAG TelePASE es {TAG} ({DOMINIO}).';

  let docLink = config.pdf_name ? `[PDF: ${config.pdf_name}]` : config.image_name ? `[Imagen: ${config.image_name}]` : '';
  
  const text = template
    .replace(/{NOMBRE}/g, nombre || 'Cliente')
    .replace(/{DOMINIO}/g, dominio || '-')
    .replace(/{TAG}/g, tagSerial || '-')
    .replace(/{ESTACION}/g, estacion || '-')
    .replace(/{LINK_DOCUMENTO}/g, docLink);

  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
}

export default function ActivationDocManagement() {
  const [config, setConfig] = useState<ActivationDocConfig>(getActivationDocConfig());
  const [points, setPoints] = useState<PeajeStock[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadedConfig = getActivationDocConfig();
    setConfig(loadedConfig);

    const loadPoints = async () => {
      const pts = await getMasterDeliveryPoints();
      setPoints(pts);
    };
    loadPoints();
  }, []);

  const handleSaveConfig = async () => {
    setLoading(true);
    setMessage(null);

    const updated = {
      ...config,
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(LOCAL_DOC_CONFIG_KEY, JSON.stringify(updated));
    setConfig(updated);

    try {
      await supabase.from('activation_doc_config').upsert([updated]);
    } catch (err) {
      console.warn('Configuración guardada localmente:', err);
    }

    setLoading(false);
    setMessage({ text: 'Configuración de documentos y envíos guardada exitosamente.', type: 'success' });
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setMessage({ text: 'El archivo debe ser un documento en formato PDF.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setConfig((prev) => ({
        ...prev,
        pdf_url: dataUrl,
        pdf_name: file.name,
      }));
      setMessage({ text: `PDF "${file.name}" cargado correctamente.`, type: 'success' });
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'El archivo debe ser una imagen (JPG, PNG, WEBP).', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setConfig((prev) => ({
        ...prev,
        image_url: dataUrl,
        image_name: file.name,
      }));
      setMessage({ text: `Imagen "${file.name}" cargada correctamente.`, type: 'success' });
    };
    reader.readAsDataURL(file);
  };

  const handleStationSenderChange = async (estacion: string, emailRemitente: string, nombreRemitente: string) => {
    const existing = points.find((p) => p.estacion === estacion);
    if (!existing) return;

    const updatedPoint: PeajeStock = {
      ...existing,
      email_remitente: emailRemitente.trim() || undefined,
      nombre_remitente: nombreRemitente.trim() || undefined,
      updated_at: new Date().toISOString(),
    };

    const updatedList = await saveMasterDeliveryPoint(updatedPoint);
    setPoints(updatedList);
  };

  return (
    <div className="space-y-6">
      {/* Header General */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-cs-primary" />
            <h2 className="text-lg font-bold text-slate-900">
              Gestión de Documentos de Activación y Envíos (Mail / WhatsApp)
            </h2>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
            Función Rol Administrador
          </span>
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

        {/* 1. Conmutadores de Estado de Envío (Activo / Inactivo) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Conmutador Email */}
          <div className={`p-4 rounded-2xl border transition ${config.email_active ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl ${config.email_active ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Envío por Email</h3>
                  <p className="text-xs text-slate-500">Enviar folleto y confirmación al mail del cliente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, email_active: !prev.email_active }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                  config.email_active ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{config.email_active ? 'ACTIVO' : 'INACTIVO'}</span>
              </button>
            </div>
          </div>

          {/* Conmutador WhatsApp */}
          <div className={`p-4 rounded-2xl border transition ${config.whatsapp_active ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl ${config.whatsapp_active ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Envío por WhatsApp</h3>
                  <p className="text-xs text-slate-500">Habilitar botones y plantilla directa de WhatsApp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, whatsapp_active: !prev.whatsapp_active }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                  config.whatsapp_active ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{config.whatsapp_active ? 'ACTIVO' : 'INACTIVO'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Carga de Documentos (PDF e Imagen) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Carga Folleto PDF */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase flex items-center space-x-1">
                <FileText className="w-4 h-4 text-cs-primary" />
                <span>Folleto Explicativo (PDF)</span>
              </span>
              {config.pdf_name && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Cargado
                </span>
              )}
            </div>

            {config.pdf_name ? (
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="truncate pr-2">
                  <p className="font-bold text-xs text-slate-900 truncate">{config.pdf_name}</p>
                  <p className="text-[10px] text-slate-500">Documento listo para adjuntar</p>
                </div>
                <div className="flex items-center space-x-1">
                  {config.pdf_url && (
                    <a
                      href={config.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                      title="Ver PDF"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, pdf_url: undefined, pdf_name: undefined }))}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition"
                    title="Eliminar PDF"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-cs-primary bg-white rounded-xl cursor-pointer transition">
                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs font-bold text-slate-700">Seleccionar PDF de Activación</span>
                <span className="text-[10px] text-slate-400">Máx. 10 MB (.pdf)</span>
                <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
              </label>
            )}
          </div>

          {/* Carga Guía de Pegado (Imagen) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase flex items-center space-x-1">
                <ImageIcon className="w-4 h-4 text-cs-primary" />
                <span>Guía de Colocación (Imagen JPG/PNG)</span>
              </span>
              {config.image_name && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Cargado
                </span>
              )}
            </div>

            {config.image_name ? (
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate pr-2">
                  {config.image_url && (
                    <img src={config.image_url} alt="Vista previa" className="w-8 h-8 rounded object-cover border" />
                  )}
                  <div className="truncate">
                    <p className="font-bold text-xs text-slate-900 truncate">{config.image_name}</p>
                    <p className="text-[10px] text-slate-500">Imagen lista para adjuntar</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {config.image_url && (
                    <a
                      href={config.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                      title="Ver Imagen"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, image_url: undefined, image_name: undefined }))}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition"
                    title="Eliminar Imagen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-cs-primary bg-white rounded-xl cursor-pointer transition">
                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs font-bold text-slate-700">Seleccionar Imagen de Pegado</span>
                <span className="text-[10px] text-slate-400">Formato JPG, PNG, WEBP</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* 3. Plantillas de Mensajes */}
        <div className="space-y-4 mb-6">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            Plantillas de Mensajes de Envío
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plantilla Email */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">Asunto del Email</label>
              <input
                type="text"
                value={config.email_subject || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, email_subject: e.target.value }))}
                className="w-full p-2.5 text-xs font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-cs-primary"
              />

              <label className="block text-xs font-bold text-slate-700 uppercase pt-2">Cuerpo del Email (Plantilla)</label>
              <textarea
                rows={5}
                value={config.email_body_template || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, email_body_template: e.target.value }))}
                className="w-full p-2.5 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-cs-primary"
              />
            </div>

            {/* Plantilla WhatsApp */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase">Mensaje WhatsApp (Plantilla Directa)</label>
              <textarea
                rows={7}
                value={config.whatsapp_body_template || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, whatsapp_body_template: e.target.value }))}
                className="w-full p-2.5 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-cs-primary"
              />
              <p className="text-[10px] text-slate-500 italic">
                Variables disponibles: <code>{'{NOMBRE}'}</code>, <code>{'{DOMINIO}'}</code>, <code>{'{TAG}'}</code>, <code>{'{ESTACION}'}</code>, <code>{'{LINK_DOCUMENTO}'}</code>
              </p>
            </div>
          </div>
        </div>

        {/* Botón Guardar Cambios */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={loading}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Configuración de Envíos</span>
          </button>
        </div>
      </div>

      {/* 4. Configuración del Email Remitente por Punto de Entrega */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
          <Mail className="w-4 h-4 text-cs-primary" />
          <span>Configuración del Email Remitente por Punto de Entrega ({points.length})</span>
        </h3>
        <p className="text-xs text-slate-500">
          Define la casilla desde la cual se enviarán los folletos y notificaciones según la estación de origen de la entrega.
        </p>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-cs-dark text-white">
              <tr>
                <th className="p-3">Punto de Entrega</th>
                <th className="p-3">Email Remitente Configurado</th>
                <th className="p-3">Nombre Remitente</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {points.map((p) => (
                <tr key={p.estacion} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-bold text-slate-900">{p.estacion}</td>
                  <td className="p-3">
                    <input
                      type="email"
                      defaultValue={p.email_remitente || p.email_notificacion || ''}
                      placeholder={`remitente.${p.estacion.toLowerCase().replace(/\s/g, '')}@caminoselva.com`}
                      onBlur={(e) => handleStationSenderChange(p.estacion, e.target.value, p.nombre_remitente || `TelePASE ${p.estacion}`)}
                      className="w-full p-1.5 border border-slate-300 rounded-lg font-mono text-xs text-slate-900 bg-white"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="text"
                      defaultValue={p.nombre_remitente || `TelePASE Estación ${p.estacion}`}
                      onBlur={(e) => handleStationSenderChange(p.estacion, p.email_remitente || '', e.target.value)}
                      className="w-full p-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white"
                    />
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                      Guardado Automático
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
