'use client';

import React, { useState } from 'react';
import { PeajeStock } from '@/types/database';
import { Mail, Send, Calendar, Clock, CheckCircle2, AlertTriangle, FileText, X, ShieldAlert, Sparkles, Building2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';

interface ScheduledReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stocks: PeajeStock[];
}

export default function ScheduledReportModal({ isOpen, onClose, stocks }: ScheduledReportModalProps) {
  const [frecuencia, setFrecuencia] = useState<'diario' | 'semanal' | 'mensual'>('diario');
  const [horaEnvio, setHoraEnvio] = useState<string>('08:00');
  const [sending, setSending] = useState<boolean>(false);
  const [reportResult, setReportResult] = useState<{
    success: boolean;
    sentCount: number;
    details: { estacion: string; email: string; stock: number; pendientes: number }[];
  } | null>(null);

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

  if (!isOpen) return null;

  const pointsWithEmail = stocks.filter((s) => s.email_notificacion && s.email_notificacion.trim().length > 0);
  const pointsWithoutEmail = stocks.filter((s) => !s.email_notificacion || s.email_notificacion.trim().length === 0);

  const handleExecuteScheduledSend = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Confirmar Envío Programado de Reporte de Inventarios',
      message: `¿Desea programar y ejecutar el envío del reporte de inventario a las ${horaEnvio}hs (${frecuencia.toUpperCase()}) a los ${pointsWithEmail.length} Puntos de Entrega con emails configurados?`,
      confirmText: 'Sí, Programar y Enviar Mails',
      type: 'primary',
      icon: 'confirm',
      onConfirm: async () => {
        setSending(true);
        setReportResult(null);

        // Simulación de envío por servicio de mailing institucional
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const sentDetails = pointsWithEmail.map((s) => ({
          estacion: s.estacion,
          email: s.email_notificacion || '',
          stock: s.stock_recibido - s.stock_entregado,
          pendientes: s.pendientes_recepcion || 0,
        }));

        setReportResult({
          success: true,
          sentCount: sentDetails.length,
          details: sentDetails,
        });

        // Guardar la configuración de programación localmente
        localStorage.setItem(
          'telepase_scheduled_email_config',
          JSON.stringify({
            frecuencia,
            horaEnvio,
            ultimoEnvio: new Date().toISOString(),
            puntosDestino: sentDetails,
          })
        );

        setSending(false);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8">
        {/* Cabecera del Modal con Estilo Camino Selva */}
        <div className="bg-cs-dark text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cs-accent/20 text-cs-accent rounded-xl border border-cs-accent/30">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base">Envío Programado de Inventarios por Punto de Entrega</h2>
              <p className="text-xs text-slate-300">Notificación automática a correos configurados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Resultado de Ejecución */}
          {reportResult && (
            <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>¡Envío Programado de Reportes Ejecutado con Éxito!</span>
              </div>
              <p className="text-xs text-emerald-800">
                Se enviaron los reportes de saldo de stock y pendientes de recepción a los <b>{reportResult.sentCount}</b> correos configurados.
              </p>
              <div className="space-y-1.5 pt-1">
                {reportResult.details.map((d) => (
                  <div
                    key={d.estacion}
                    className="flex items-center justify-between bg-white/80 p-2 rounded-xl text-xs border border-emerald-200"
                  >
                    <span className="font-bold text-slate-800 flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5 text-cs-primary" />
                      <span>{d.estacion}</span>
                    </span>
                    <span className="font-mono text-sky-800 bg-sky-50 px-2 py-0.5 rounded font-semibold">
                      {d.email}
                    </span>
                    <span className="font-mono font-bold text-emerald-900">
                      Saldo: {d.stock} u. | Pend: {d.pendientes} u.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selector de Frecuencia y Horario de Envío Programado */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-cs-primary uppercase tracking-wide flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Configuración de Programación y Frecuencia</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Frecuencia de Envío</label>
                <select
                  value={frecuencia}
                  onChange={(e) => setFrecuencia(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white"
                >
                  <option value="diario">Diario (Todos los días)</option>
                  <option value="semanal">Semanal (Lunes de cada semana)</option>
                  <option value="mensual">Mensual (Primer día hábil del mes)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Hora Programada de Dispatch</label>
                <div className="relative">
                  <input
                    type="time"
                    value={horaEnvio}
                    onChange={(e) => setHoraEnvio(e.target.value)}
                    className="w-full p-2.5 pr-8 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-white"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Listado de Puntos de Entrega con Mails Destino */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Send className="w-4 h-4 text-cs-primary" />
                <span>Puntos de Entrega con Mail Configurado ({pointsWithEmail.length})</span>
              </span>
              <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                Notificación por Punto
              </span>
            </h3>

            {pointsWithEmail.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  No hay emails de destino configurados. Ingrese a la pestaña <b>"Puntos de Entrega"</b> para agregar los mails de notificación a cada estación.
                </span>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-white">
                {pointsWithEmail.map((p) => {
                  const disponible = p.stock_recibido - p.stock_entregado;
                  return (
                    <div
                      key={p.estacion}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">{p.estacion}</span>
                        <span className="font-mono text-[11px] text-sky-800 bg-sky-100/70 px-2 py-0.5 rounded font-semibold inline-block mt-0.5">
                          {p.email_notificacion}
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="block font-bold text-slate-900">{disponible} TAGs disp.</span>
                        <span className="text-[10px] text-amber-700 font-semibold">
                          Pend. rec: {p.pendientes_recepcion || 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pointsWithoutEmail.length > 0 && (
              <p className="text-[11px] text-slate-500 italic">
                * {pointsWithoutEmail.length} estación(es) sin mail configurado ({pointsWithoutEmail.map((p) => p.estacion).join(', ')}).
              </p>
            )}
          </div>
        </div>

        {/* Footer con Acciones */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition uppercase"
          >
            Cerrar
          </button>

          <button
            onClick={handleExecuteScheduledSend}
            disabled={sending || pointsWithEmail.length === 0}
            className="px-6 py-2.5 bg-cs-primary hover:bg-cs-dark text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50 uppercase tracking-wider"
          >
            <Send className="w-4 h-4 text-cs-accent" />
            <span>{sending ? 'Procesando Envío...' : 'Ejecutar Envío Programado'}</span>
          </button>
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
