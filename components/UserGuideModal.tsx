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
  AlertTriangle,
  Info,
  Copy,
  QrCode,
  Tag,
  Car,
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserGuideModal({ isOpen, onClose }: UserGuideModalProps) {
  const [activeTopic, setActiveTopic] = useState<'inicio' | 'paso_a_paso' | 'flotas' | 'circuito_stock' | 'errores' | 'roles' | 'reportes'>('inicio');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-cs-dark text-white p-4 sm:p-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Manual de Aprendizaje y Guía Paso a Paso - TelePASE</h2>
              <p className="text-xs text-emerald-200">
                Aprende a operar el sistema desde cero: Entregas, Inventarios, Transferencias y Solución de Errores
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Sidebar Navigation */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Menu Lateral de Temas */}
          <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-3 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto flex-shrink-0">
            <button
              onClick={() => setActiveTopic('inicio')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition cursor-pointer ${
                activeTopic === 'inicio'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>1. Conceptos Básicos</span>
            </button>

            <button
              onClick={() => setActiveTopic('paso_a_paso')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition cursor-pointer ${
                activeTopic === 'paso_a_paso'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>2. Registrar Entrega (Paso a Paso)</span>
            </button>

            <button
              onClick={() => setActiveTopic('flotas')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition cursor-pointer ${
                activeTopic === 'flotas'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Copy className="w-4 h-4 flex-shrink-0" />
              <span>3. Replicación Flotas / Empresas</span>
            </button>

            <button
              onClick={() => setActiveTopic('circuito_stock')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition cursor-pointer ${
                activeTopic === 'circuito_stock'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Truck className="w-4 h-4 flex-shrink-0" />
              <span>4. Circuito de Stock & Envíos</span>
            </button>

            <button
              onClick={() => setActiveTopic('errores')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition cursor-pointer ${
                activeTopic === 'errores'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-300" />
              <span>5. Solución de Mensajes de Error</span>
            </button>

            <button
              onClick={() => setActiveTopic('roles')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition cursor-pointer ${
                activeTopic === 'roles'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>6. Roles y Claves de Respaldo</span>
            </button>

            <button
              onClick={() => setActiveTopic('reportes')}
              className={`w-full p-2.5 rounded-xl text-xs font-bold text-left flex items-center space-x-2 transition cursor-pointer ${
                activeTopic === 'reportes'
                  ? 'bg-cs-primary text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
              <span>7. Exportar Excel / CSV</span>
            </button>
          </div>

          {/* Contenido Principal de las Guías */}
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800 text-sm">
            {/* TEMA 1: CONCEPTOS BÁSICOS */}
            {activeTopic === 'inicio' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <Info className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">1. ¿Qué es la Plataforma TelePASE y cómo funciona?</h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Esta plataforma fue diseñada para que el personal de peaje de **Camino Selva S.A.** pueda registrar en segundos la entrega de obleas TelePASE a los conductores, controlar el inventario de obleas asignadas a cada peaje y rastrear los envíos entre estaciones.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-2">
                    <div className="flex items-center space-x-2 font-bold text-emerald-900 text-xs">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      <span>¿Qué es el Número de TAG Serial?</span>
                    </div>
                    <p className="text-xs text-emerald-950 leading-relaxed">
                      Es un código numérico único impreso en el sticker/oblea RFID (ej: <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-900">63230000</code>). Este número identifica la tarjeta que se pega en el parabrisas del vehículo.
                    </p>
                  </div>

                  <div className="p-4 bg-sky-50/60 border border-sky-200/80 rounded-2xl space-y-2">
                    <div className="flex items-center space-x-2 font-bold text-sky-900 text-xs">
                      <MapPin className="w-4 h-4 text-sky-600" />
                      <span>¿Cuáles son los Puntos de Entrega?</span>
                    </div>
                    <p className="text-xs text-sky-950 leading-relaxed">
                      Son las 5 estaciones oficiales del corredor: <b>Santa Ana</b>, <b>Colonia Victoria</b>, <b>Paraje Fachinal</b>, <b>Ituzaingó</b> y <b>Oficina Central</b>.
                    </p>
                  </div>
                </div>

                {/* Banner de Inicio Rápido */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-xs text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Regla de Oro en Peaje:</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Un TAG solo se puede entregar en vía si se encuentra **FÍSICAMENTE Y EN SISTEMA** asignado a la estación donde trabajas. Si el sistema dice que el TAG no pertenece a tu estación, debes confirmar la recepción en la pestaña <b>Movimientos</b>.
                  </p>
                </div>
              </div>
            )}

            {/* TEMA 2: PASO A PASO "MI PRIMERA ENTREGA" */}
            {activeTopic === 'paso_a_paso' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <CheckCircle2 className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">2. Guía Paso a Paso: ¿Cómo registrar una Entrega de TAG?</h3>
                </div>

                <p className="text-xs text-slate-600">
                  Sigue esta secuencia exacta cuando un vehículo se detiene a solicitar o colocar su TelePASE:
                </p>

                {/* Mockup Interactivo de Pasos */}
                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-cs-primary text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="space-y-1 text-xs">
                      <b className="text-slate-900 text-sm">Verifica tu Punto de Entrega Seleccionado</b>
                      <p className="text-slate-600">
                        El primer campo del formulario es <b>Punto de Entrega</b>. Debe coincidir con el peaje donde estás trabajando (ej: <i>Santa Ana</i>).
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-cs-primary text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="space-y-1 text-xs">
                      <b className="text-slate-900 text-sm">Ingresa la Patente / Dominio del Vehículo</b>
                      <p className="text-slate-600">
                        Escribe la patente sin espacios ni guiones. Ejemplos válidos: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono font-bold">AB123CD</code> o <code className="bg-slate-200 px-1 py-0.5 rounded font-mono font-bold">AA100BB</code>.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-cs-primary text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="space-y-1 text-xs">
                      <b className="text-slate-900 text-sm">Ingresa DNI / CUIT y Nombre del Conductor</b>
                      <p className="text-slate-600">
                        Escribe el número de documento o CUIT (ej: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono font-bold">30712345678</code>) y el nombre completo del conductor o razón social de la empresa.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-cs-primary text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      4
                    </div>
                    <div className="space-y-1 text-xs">
                      <b className="text-slate-900 text-sm">Ingresa el Número de Serie del TAG RFID</b>
                      <p className="text-slate-600">
                        Tipea o escanea el código de 8 dígitos del sticker (ej: <code className="bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded font-mono font-bold">63230000</code>).
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      5
                    </div>
                    <div className="space-y-1 text-xs">
                      <b className="text-emerald-950 text-sm">Presiona "REGISTRAR ENTREGA DE TAGS"</b>
                      <p className="text-emerald-900">
                        ¡Listo! El formulario se limpiará automáticamente para la siguiente entrega, la disponibilidad de la estación se actualizará y la fila aparecerá en la grilla de abajo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TEMA 3: REPLICACIÓN FLOTAS / EMPRESAS */}
            {activeTopic === 'flotas' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <Copy className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">3. Replicación de Nombre y CUIT para Empresas y Flotas</h3>
                </div>

                <p className="text-xs text-slate-600">
                  ¿Llegó un chofer o apoderado a registrar **10 camiones de la misma empresa**? No pierdas tiempo escribiendo la misma razón social y CUIT 10 veces.
                </p>

                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl space-y-3 text-xs">
                  <b className="text-sky-900 text-sm flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span>Cómo usar los botones de replicación:</span>
                  </b>

                  <ol className="list-decimal list-inside space-y-2 text-sky-950">
                    <li>Completa los datos del **primer vehículo** normalmente (Nombre: <i>Transporte Selva S.R.L.</i>, CUIT: <i>30711112223</i>).</li>
                    <li>Antes de enviar, presiona los botones azules **"Replicar Nombre"** y **"Replicar CUIT"** que están junto a los campos.</li>
                    <li>Al hacer clic en **Registrar Entrega**, el sistema guardará el primer vehículo pero **MANTENDRÁ EL NOMBRE Y EL CUIT RELLENADOS** para el siguiente formulario.</li>
                    <li>Para el segundo camión, solo tendrás que escribir la nueva Patente y el nuevo TAG. ¡Ahorras más del 70% del tiempo de carga!</li>
                  </ol>
                </div>
              </div>
            )}

            {/* TEMA 4: CIRCUITO DE STOCK & ENVÍOS */}
            {activeTopic === 'circuito_stock' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <Truck className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">4. ¿De dónde sale el Stock? (Circuito de Inventario)</h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Entiende cómo viaja una oblea TelePASE desde que la empresa la compra hasta que la entregas en la casilla:
                </p>

                {/* Diagrama Visual */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                      <div className="font-bold text-emerald-400">1. Fábrica</div>
                      <div className="text-[10px] text-slate-300 mt-1">Lote inicial de 20.000 TAGs</div>
                    </div>
                    <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                      <div className="font-bold text-emerald-400">2. Oficina Central</div>
                      <div className="text-[10px] text-slate-300 mt-1">Envía transferencias a los peajes</div>
                    </div>
                    <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                      <div className="font-bold text-emerald-400">3. Peaje Destino</div>
                      <div className="text-[10px] text-slate-300 mt-1">Confirma "Pend. Recepción"</div>
                    </div>
                    <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
                      <div className="font-bold text-emerald-400">4. Entrega en Vía</div>
                      <div className="text-[10px] text-slate-300 mt-1">Se entrega al auto (-1 disp.)</div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs">
                  <b className="text-amber-900 flex items-center space-x-1">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span>Indicadores de las Tarjetas de Estación:</span>
                  </b>
                  <ul className="list-disc list-inside space-y-1 text-amber-950 font-medium">
                    <li><b>Disponible (disp.)</b>: Cantidad de TAGs que tu peaje tiene listos para entregar ya mismo.</li>
                    <li><b>Entregados</b>: TAGs que ya fueron colocados en vehículos en tu estación.</li>
                    <li><b>Enviados</b>: TAGs que tu estación envió mediante transferencias a otros peajes.</li>
                    <li><b>Pend. Recepción</b>: TAGs que vienen en viaje hacia tu peaje. Debes presionar "Confirmar Recepción" en la pestaña Movimientos.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TEMA 5: SOLUCIÓN DE ERRORES FRECUENTES */}
            {activeTopic === 'errores' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-base text-slate-900">5. Guía de Solución de Errores Frecuentes</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                    <b className="text-rose-900 text-sm">❌ Error: "El TAG NO corresponde a ningún lote ni transferencia en la estación"</b>
                    <p className="text-rose-950">
                      <b>¿Por qué ocurre?</b> Tipeaste un número de TAG que físicamente pertenece a otro peaje o que aún no fue cargado en el sistema.
                    </p>
                    <p className="text-rose-900 font-semibold">
                      <b>Solución:</b> Revisa que no hayas ingresado mal algún número. Si el número es correcto, consulta en la pestaña <b>Movimientos</b> si el remito figura como "En Tránsito".
                    </p>
                  </div>

                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                    <b className="text-amber-900 text-sm">⚠️ Error: "El TAG proviene de una transferencia PENDIENTE DE RECEPCIÓN"</b>
                    <p className="text-amber-950">
                      <b>¿Por qué ocurre?</b> La caja de TAGs llegó al peaje pero ningún operador entró al sistema a confirmar la recepción.
                    </p>
                    <p className="text-amber-900 font-semibold">
                      <b>Solución:</b> Haz clic en la pestaña <b>Movimientos</b> y presiona el botón verde <b>"Confirmar Recepción"</b>. Luego vuelve al formulario y regístralo.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl space-y-1">
                    <b className="text-slate-900 text-sm">🚫 Error: "El TAG ya fue entregado previamente"</b>
                    <p className="text-slate-700">
                      <b>¿Por qué ocurre?</b> Ese número de oblea ya figura registrado a otro vehículo. El sistema no permite entregar el mismo TAG dos veces.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TEMA 6: ROLES Y CLAVES */}
            {activeTopic === 'roles' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <Users className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">6. Permisos de Usuario y Claves Maestras por Defecto</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5">
                    <b className="text-amber-900 text-sm">Rol Administrador</b>
                    <p className="text-amber-950 leading-relaxed">
                      Acceso total. Puede gestionar usuarios, crear lotes de fábrica, editar entregas o limpiar la base de datos.
                    </p>
                    <div className="pt-1 font-mono font-bold text-slate-900 bg-amber-100 p-1.5 rounded text-center">
                      Clave: Cee$$2026
                    </div>
                  </div>

                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1.5">
                    <b className="text-emerald-900 text-sm">Rol Operador</b>
                    <p className="text-emerald-950 leading-relaxed">
                      Perfil para trabajo diario en casilla de peaje. Registra entregas y confirma transferencias.
                    </p>
                    <div className="pt-1 font-mono font-bold text-slate-900 bg-emerald-100 p-1.5 rounded text-center">
                      Clave: op123456
                    </div>
                  </div>

                  <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl space-y-1.5">
                    <b className="text-sky-900 text-sm">Rol Consulta</b>
                    <p className="text-sky-950 leading-relaxed">
                      Perfil de auditoría y supervisión. Solo lectura de stocks e informes (no puede registrar ni editar).
                    </p>
                    <div className="pt-1 font-mono font-bold text-slate-900 bg-sky-100 p-1.5 rounded text-center">
                      Clave: consulta123
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TEMA 7: EXPORTACIÓN DE REPORTES */}
            {activeTopic === 'reportes' && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
                  <FileSpreadsheet className="w-5 h-5 text-cs-primary" />
                  <h3 className="font-bold text-base text-slate-900">7. Descarga de Reportes en Excel (.xlsx) y CSV</h3>
                </div>

                <p className="text-xs text-slate-600">
                  Los botones <b>"Descargar XLS"</b> y <b>"CSV"</b> generan un reporte exacto de lo que ves filtrado en la pantalla.
                </p>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-xs">
                  <b className="text-emerald-900">Columnas oficiales del archivo Excel:</b>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono font-bold text-emerald-950 pt-1">
                    <div className="p-2 bg-emerald-100/70 rounded">1. Fecha/Hora</div>
                    <div className="p-2 bg-emerald-100/70 rounded">2. Punto de Entrega</div>
                    <div className="p-2 bg-emerald-100/70 rounded">3. Patente</div>
                    <div className="p-2 bg-emerald-100/70 rounded">4. TAG Serial</div>
                    <div className="p-2 bg-emerald-100/70 rounded">5. DNI / CUIT</div>
                    <div className="p-2 bg-emerald-100/70 rounded">6. Nombre Receptor</div>
                    <div className="p-2 bg-emerald-100/70 rounded col-span-2">7. Usuario Registrador</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            Plataforma TelePASE • Corredor Vial Noreste - Camino Selva S.A.
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-cs-primary hover:bg-cs-dark text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Entendido / Cerrar Guía
          </button>
        </div>
      </div>
    </div>
  );
}
