'use client';

import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  BookOpen,
  CheckCircle2,
  Truck,
  PackageCheck,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  MapPin,
  Lock,
  Search,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserGuideModal({ isOpen, onClose }: UserGuideModalProps) {
  const [activeTopic, setActiveTopic] = useState<'entregas' | 'transferencias' | 'lotes' | 'estaciones' | 'usuarios' | 'auditoria' | 'reportes'>('entregas');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-cs-dark text-white p-4 sm:p-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Guía de Operación y Manual del Sistema TelePASE</h2>
              <p className="text-xs text-emerald-200">
                Instrucciones paso a paso para el uso de cada módulo de la plataforma
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Sidebar Navigation */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Menu Lateral de Temas */}
          <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto flex-shrink-0">
            <button
              onClick={() => setActiveTopic('entregas')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition ${
                activeTopic === 'entregas'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>1. Entrega de TAGs</span>
            </button>

            <button
              onClick={() => setActiveTopic('transferencias')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition ${
                activeTopic === 'transferencias'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Truck className="w-4 h-4 flex-shrink-0" />
              <span>2. Movimientos / Envíos</span>
            </button>

            <button
              onClick={() => setActiveTopic('lotes')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition ${
                activeTopic === 'lotes'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <PackageCheck className="w-4 h-4 flex-shrink-0" />
              <span>3. Alta de Lotes</span>
            </button>

            <button
              onClick={() => setActiveTopic('estaciones')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition ${
                activeTopic === 'estaciones'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>4. Puntos de Entrega</span>
            </button>

            <button
              onClick={() => setActiveTopic('usuarios')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition ${
                activeTopic === 'usuarios'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>5. Usuarios y Roles</span>
            </button>

            <button
              onClick={() => setActiveTopic('auditoria')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition ${
                activeTopic === 'auditoria'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>6. Auditoría y Logs</span>
            </button>

            <button
              onClick={() => setActiveTopic('reportes')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition ${
                activeTopic === 'reportes'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
              <span>7. Excel / CSV</span>
            </button>
          </div>

          {/* Contenido Principal de las Guías */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 text-slate-800 text-sm">
            {/* TEMA 1: ENTREGAS DE TAGS EN VÍA */}
            {activeTopic === 'entregas' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <CheckCircle2 className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">1. Registración Agil de Entregas de TAGs</h3>
                </div>

                <p className="text-xs text-slate-600">
                  Formulario simplificado para la entrega directa en vía a conductores. Optimizado para pantallas táctiles y celulares.
                </p>

                <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-emerald-900 flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Pasos para registrar una entrega:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-emerald-950 font-medium">
                    <li>Seleccione el <b>Punto de Entrega</b> (Santa Ana, Victoria, Fachinal, Ituzaingó, etc.).</li>
                    <li>Ingrese la <b>Patente / Dominio</b> del vehículo y el <b>DNI / CUIT</b> del titular.</li>
                    <li>Ingrese el <b>Nombre Receptor</b> y verifique la cantidad de TAGs a entregar.</li>
                    <li>Escriba o escanee el número de <b>Serie del TAG RFID</b>.</li>
                    <li>Haga clic en <b>REGISTRAR ENTREGA DE TAGS</b>.</li>
                  </ol>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <b className="text-slate-900 flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-cs-primary" />
                      <span>Replicar Datos Empresa / Flota</span>
                    </b>
                    <p className="text-slate-600">
                      Utilice el botón <b>"Replicar Nombre y CUIT"</b> para mantener el titular al registrar varios vehículos de una misma empresa.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <b className="text-slate-900 flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-cs-primary" />
                      <span>Validación de Stock Origen</span>
                    </b>
                    <p className="text-slate-600">
                      El sistema verifica en tiempo real que el TAG pertenezca al Punto de Entrega seleccionado y que no haya sido entregado.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TEMA 2: MOVIMIENTOS Y TRANSFERENCIAS */}
            {activeTopic === 'transferencias' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <Truck className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">2. Movimientos y Transferencias entre Estaciones</h3>
                </div>

                <p className="text-xs text-slate-600">
                  Permite mover lotes de TAGs entre la Oficina Central y los Peajes del Corredor Vial Noreste.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                    <b className="text-amber-900 flex items-center space-x-1">
                      <ArrowRight className="w-4 h-4 text-amber-600" />
                      <span>1. Enviar Transferencia (Origen)</span>
                    </b>
                    <p className="text-amber-950">
                      Seleccione Origen, Destino y el rango de series (<b>Serie Desde</b> y <b>Serie Hasta</b>). El sistema validará que los TAGs se encuentren físicamente en el origen. Al enviar, el estado pasa a <b>"En Tránsito"</b>.
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                    <b className="text-emerald-900 flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>2. Recepcionar Remito (Destino)</span>
                    </b>
                    <p className="text-emerald-950">
                      El peaje de destino visualizará la alerta <b>"Pend. Recepción"</b> en su tarjeta. Debe hacer clic en <b>"Confirmar Recepción"</b> para sumar las unidades a su stock disponible y poder entregarlas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TEMA 3: ALTA DE LOTES */}
            {activeTopic === 'lotes' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <PackageCheck className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">3. Recepción y Alta de Lotes de Fábrica</h3>
                </div>

                <p className="text-xs text-slate-600">
                  Reservado para Administradores. Registra la incorporación de nuevos lotes de fábrica de TAGs RFID al inventario.
                </p>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <b className="text-slate-900">Campos obligatorios:</b>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    <li><b>Punto de Entrega</b>: Generalmente <i>Oficina Central</i>.</li>
                    <li><b>Serie Desde / Serie Hasta</b>: Rango numérico del remito.</li>
                    <li><b>Cantidad</b>: Unidades calculadas de forma automática.</li>
                    <li><b>Número de Remito / Observaciones</b>.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TEMA 4: PUNTOS DE ENTREGA */}
            {activeTopic === 'estaciones' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <MapPin className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">4. Maestro de Puntos de Entrega</h3>
                </div>

                <p className="text-xs text-slate-600">
                  Gestión de las estaciones oficiales: Santa Ana, Colonia Victoria, Paraje Fachinal, Ituzaingó y Oficina Central.
                </p>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <b className="text-slate-900">Configuración de Alertas:</b>
                  <p className="text-slate-700">
                    Se puede definir el <b>Stock Mínimo de Alerta</b> para destacar la tarjeta en color rojo cuando las unidades disponibles desciendan del umbral configurado.
                  </p>
                </div>
              </div>
            )}

            {/* TEMA 5: USUARIOS Y ROLES */}
            {activeTopic === 'usuarios' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <Users className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">5. Usuarios, Roles y Claves de Respaldo</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                    <b className="text-amber-900">Rol Administrador</b>
                    <p className="text-amber-950">Acceso total, edición/eliminación de entregas, botón "Limpiar Entregas". Clave: <code className="font-mono font-bold text-slate-900">Cee$$2026</code>.</p>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                    <b className="text-emerald-900">Rol Operador</b>
                    <p className="text-emerald-950">Registro de entregas en vía y movimientos de su estación. Clave: <code className="font-mono font-bold text-slate-900">op123456</code>.</p>
                  </div>

                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl space-y-1">
                    <b className="text-sky-900">Rol Consulta</b>
                    <p className="text-sky-950">Acceso de solo lectura para auditoría y consulta de stock. Clave: <code className="font-mono font-bold text-slate-900">consulta123</code>.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <b className="text-slate-900 flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5 text-cs-primary" />
                    <span>Opción "Recordar mi usuario"</span>
                  </b>
                  <p className="text-slate-600">
                    Al marcar la casilla en el Login, el correo del usuario queda guardado para evitar tener que tipearlo en cada inicio de sesión.
                  </p>
                </div>
              </div>
            )}

            {/* TEMA 6: AUDITORÍA */}
            {activeTopic === 'auditoria' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <ShieldAlert className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">6. Log de Usuarios y Registro de Auditoría</h3>
                </div>

                <p className="text-xs text-slate-600">
                  Toda operación realizada (inicio de sesión, registraciones, transferencias, ediciones y eliminaciones) es guardada en un registro de auditoría inalterable.
                </p>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                  <b className="text-slate-900">Auditoría de Rol Administrador:</b>
                  <p className="text-slate-700">
                    Incluso el uso de funciones administrativas (como la limpieza de datos o edición de entregas) queda registrado indicando fecha, hora, usuario y dirección de la operación.
                  </p>
                </div>
              </div>
            )}

            {/* TEMA 7: EXPORTACIÓN A EXCEL Y CSV */}
            {activeTopic === 'reportes' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <FileSpreadsheet className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">7. Exportación a Excel (.xlsx) y CSV</h3>
                </div>

                <p className="text-xs text-slate-600">
                  Descarga instantánea de los registros filtrados en pantalla con las 7 columnas oficiales:
                </p>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                  <b className="text-emerald-900">Columnas de los Reportes:</b>
                  <ol className="list-decimal list-inside space-y-1 text-emerald-950 font-mono font-medium">
                    <li>Fecha/Hora</li>
                    <li>Punto de Entrega</li>
                    <li>Patente</li>
                    <li>TAG Serial</li>
                    <li>DNI / CUIT</li>
                    <li>Nombre Receptor</li>
                    <li>Usuario Registrador</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cs-primary hover:bg-cs-dark text-white font-bold text-xs rounded-xl shadow-xs transition"
          >
            Entendido / Cerrar Guía
          </button>
        </div>
      </div>
    </div>
  );
}
