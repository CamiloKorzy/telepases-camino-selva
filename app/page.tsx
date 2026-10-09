'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { TagDelivery, PeajeStock, UserSession, TagBatch, TagTransfer } from '@/types/database';
import DeliveryForm from '@/components/DeliveryForm';
import LoginForm from '@/components/LoginForm';
import UserManagement from '@/components/UserManagement';
import BatchManagement from '@/components/BatchManagement';
import DeliveryPointManagement from '@/components/DeliveryPointManagement';
import TransferManagement from '@/components/TransferManagement';
import { getMasterDeliveryPoints } from '@/lib/deliveryPoints';
import { Download, Search, RefreshCw, Layers, ShieldCheck, AlertTriangle, LogOut, User, FileSpreadsheet, LayoutDashboard, PlusCircle, Users, MapPin, Edit2, Trash2, X, Save, Truck } from 'lucide-react';

export default function AntigravityDashboard() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [deliveries, setDeliveries] = useState<TagDelivery[]>([]);
  const [stocks, setStocks] = useState<PeajeStock[]>([]);
  const [availableStations, setAvailableStations] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState<string>('Todas');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transfers' | 'settings_batches' | 'settings_points' | 'settings_users'>('dashboard');

  // Estado para edición de entrega por Administrador
  const [editingDelivery, setEditingDelivery] = useState<TagDelivery | null>(null);
  const [editEstacion, setEditEstacion] = useState('');
  const [editDominio, setEditDominio] = useState('');
  const [editTagSerial, setEditTagSerial] = useState('');
  const [editDniCuit, setEditDniCuit] = useState('');
  const [editNombreReceptor, setEditNombreReceptor] = useState('');
  const [editObservaciones, setEditObservaciones] = useState('');

  // Cargar sesión al iniciar y escuchar actualizaciones
  const syncSession = () => {
    const stored = localStorage.getItem('telepase_user_session');
    if (stored) {
      try {
        const session: UserSession = JSON.parse(stored);
        if (session.activo !== false) {
          if (!session.rol) {
            session.rol = 'Administrador';
            localStorage.setItem('telepase_user_session', JSON.stringify(session));
          }
          setUserSession(session);
        } else {
          localStorage.removeItem('telepase_user_session');
          setUserSession(null);
        }
      } catch {
        localStorage.removeItem('telepase_user_session');
        setUserSession(null);
      }
    } else {
      setUserSession(null);
    }
  };

  useEffect(() => {
    syncSession();

    const handleSessionUpdated = () => syncSession();
    window.addEventListener('user_session_updated', handleSessionUpdated);
    return () => window.removeEventListener('user_session_updated', handleSessionUpdated);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    let remoteDeliveries: TagDelivery[] = [];
    let localDeliveries: TagDelivery[] = [];
    let localBatches: TagBatch[] = [];

    // 1. Obtener entregas guardadas en localStorage inmediatamente
    const storedLocalDeliveries = localStorage.getItem('telepase_local_tag_deliveries');
    if (storedLocalDeliveries) {
      try {
        localDeliveries = JSON.parse(storedLocalDeliveries);
      } catch {}
    }

    // Consultar Supabase en segundo plano con timeout rápido (1.5s)
    try {
      const fetchDeliveries = supabase.from('tag_deliveries').select('*').order('created_at', { ascending: false }).limit(300);
      const timeoutPromise = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 1500));
      const res = await Promise.race([fetchDeliveries, timeoutPromise]);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        remoteDeliveries = res.data;
      }
    } catch {}

    // Combinar entregas remotas y locales sin duplicados
    const deliveryMap = new Map<string, TagDelivery>();
    [...localDeliveries, ...remoteDeliveries].forEach((d) => {
      const key = d.id || d.tag_serial;
      if (!deliveryMap.has(key)) {
        deliveryMap.set(key, d);
      }
    });

    const allDeliveries = Array.from(deliveryMap.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    setDeliveries(allDeliveries);

    // 2. Obtener Maestro Oficial de Puntos de Entrega (Respuesta Inmediata)
    const masterPoints = await getMasterDeliveryPoints();
    const stationNamesList = masterPoints.map((p) => p.estacion);
    setAvailableStations(stationNamesList);

    // 3. Obtener Lotes/Recepciones de localStorage y Supabase con timeout
    const storedBatches = localStorage.getItem('telepase_local_tag_batches');
    if (storedBatches) {
      try {
        localBatches = JSON.parse(storedBatches);
        // Auto-corregir cantidad de lote de 501 -> 500
        let updated = false;
        localBatches = localBatches.map((b) => {
          if (b.serial_desde === '63226500' && b.serial_hasta === '63227000' && b.cantidad === 501) {
            updated = true;
            return { ...b, cantidad: 500 };
          }
          return b;
        });
        if (updated) {
          localStorage.setItem('telepase_local_tag_batches', JSON.stringify(localBatches));
        }
      } catch {}
    }

    let remoteBatches: TagBatch[] = [];
    try {
      const fetchBatches = supabase.from('tag_batches').select('*');
      const timeoutPromise = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 1500));
      const res = await Promise.race([fetchBatches, timeoutPromise]);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        remoteBatches = res.data;
      }
    } catch {}

    const batchMap = new Map<string, TagBatch>();
    [...remoteBatches, ...localBatches].forEach((b) => {
      const key = b.id || `${b.estacion}_${b.serial_desde}_${b.serial_hasta}`;
      if (!batchMap.has(key)) {
        batchMap.set(key, b);
      }
    });
    const allBatches = Array.from(batchMap.values());

    // 4. Obtener Movimientos de Transferencias (Envíos y Recepciones)
    let remoteTransfers: TagTransfer[] = [];
    let localTransfers: TagTransfer[] = [];
    const storedTransfers = localStorage.getItem('telepase_local_tag_transfers');
    if (storedTransfers) {
      try {
        localTransfers = JSON.parse(storedTransfers);
      } catch {}
    }

    try {
      const fetchTransfers = supabase.from('tag_transfers').select('*');
      const timeoutPromise = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 1500));
      const res = await Promise.race([fetchTransfers, timeoutPromise]);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        remoteTransfers = res.data;
      }
    } catch {}

    const transferMap = new Map<string, TagTransfer>();
    [...remoteTransfers, ...localTransfers].forEach((t) => {
      const key = t.id || `${t.origen}_${t.destino}_${t.serial_desde}_${t.serial_hasta}`;
      if (!transferMap.has(key)) {
        transferMap.set(key, t);
      }
    });
    const allTransfers = Array.from(transferMap.values());

    const finalStocks: PeajeStock[] = masterPoints.map((pt) => {
      const st = pt.estacion;
      
      // Stock recibido por Alta de Lotes
      const lotesEstacion = allBatches.filter((b) => b.estacion.toLowerCase() === st.toLowerCase());
      const totalRecibidoLotes = lotesEstacion.reduce((acc, b) => acc + (Number(b.cantidad) || 0), 0);

      // Stock recibido por Transferencias (confirmadas como 'Recibido')
      const transfRecibidas = allTransfers.filter((t) => t.destino.toLowerCase() === st.toLowerCase() && t.estado === 'Recibido');
      const totalRecibidoTransf = transfRecibidas.reduce((acc, t) => acc + (Number(t.cantidad) || 0), 0);

      // Stock total acreditado a la estación
      const totalStockRecibido = totalRecibidoLotes + totalRecibidoTransf;

      // Stock enviado a otros Puntos de Entrega (En Tránsito o Recibido)
      const transfEnviadas = allTransfers.filter((t) => t.origen.toLowerCase() === st.toLowerCase() && t.estado !== 'Cancelado');
      const totalEnviadoTransf = transfEnviadas.reduce((acc, t) => acc + (Number(t.cantidad) || 0), 0);

      // Entregados en vía a vehículos
      const entregadosVia = allDeliveries.filter((d) => d.estacion.toLowerCase() === st.toLowerCase()).length;

      // Total salidas de la estación
      const totalStockSalidas = entregadosVia + totalEnviadoTransf;

      return {
        estacion: st,
        stock_recibido: totalStockRecibido,
        stock_entregado: totalStockSalidas,
        stock_minimo_alerta: pt.stock_minimo_alerta || 100,
      };
    });

    setStocks(finalStocks);
    setLoading(false);
  };

  useEffect(() => {
    if (userSession) {
      if (userSession.punto_entrega && userSession.punto_entrega !== 'Todos') {
        setSelectedStation(userSession.punto_entrega);
      }
      fetchData();
    }

    const handleUpdated = () => fetchData();
    window.addEventListener('delivery_points_updated', handleUpdated);
    window.addEventListener('tag_batches_updated', handleUpdated);
    window.addEventListener('tag_transfers_updated', handleUpdated);
    return () => {
      window.removeEventListener('delivery_points_updated', handleUpdated);
      window.removeEventListener('tag_batches_updated', handleUpdated);
      window.removeEventListener('tag_transfers_updated', handleUpdated);
    };
  }, [userSession]);

  const handleLogout = () => {
    localStorage.removeItem('telepase_user_session');
    supabase.auth.signOut();
    setUserSession(null);
  };

  const handleStartEditDelivery = (item: TagDelivery) => {
    setEditingDelivery(item);
    setEditEstacion(item.estacion);
    setEditDominio(item.dominio);
    setEditTagSerial(item.tag_serial);
    setEditDniCuit(item.dni_cuit);
    setEditNombreReceptor(item.nombre_apellido || '');
    setEditObservaciones(item.observaciones || '');
  };

  const handleUpdateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery) return;

    const updatedPayload: TagDelivery = {
      ...editingDelivery,
      estacion: editEstacion,
      dominio: editDominio.toUpperCase().replace(/\s/g, ''),
      tag_serial: editTagSerial.trim().toUpperCase(),
      dni_cuit: editDniCuit.trim(),
      nombre_apellido: editNombreReceptor.trim(),
      observaciones: editObservaciones.trim(),
    };

    try {
      if (editingDelivery.id) {
        await supabase.from('tag_deliveries').update(updatedPayload).eq('id', editingDelivery.id);
      }
    } catch {}

    const stored = localStorage.getItem('telepase_local_tag_deliveries');
    if (stored) {
      try {
        const localList: TagDelivery[] = JSON.parse(stored);
        const updatedList = localList.map((d) =>
          d.id === editingDelivery.id || d.tag_serial === editingDelivery.tag_serial ? updatedPayload : d
        );
        localStorage.setItem('telepase_local_tag_deliveries', JSON.stringify(updatedList));
      } catch {}
    }

    setEditingDelivery(null);
    fetchData();
  };

  const handleDeleteDelivery = async (item: TagDelivery) => {
    if (!confirm(`¿Está seguro de que desea eliminar la entrega del TAG ${item.tag_serial} (Patente ${item.dominio})?`)) {
      return;
    }

    try {
      if (item.id) {
        await supabase.from('tag_deliveries').delete().eq('id', item.id);
      }
    } catch {}

    const stored = localStorage.getItem('telepase_local_tag_deliveries');
    if (stored) {
      try {
        const localList: TagDelivery[] = JSON.parse(stored);
        const updatedList = localList.filter((d) => d.id !== item.id && d.tag_serial !== item.tag_serial);
        localStorage.setItem('telepase_local_tag_deliveries', JSON.stringify(updatedList));
      } catch {}
    }

    fetchData();
  };

  // Filtrado de búsquedas
  const filteredDeliveries = deliveries.filter((d) => {
    const matchesSearch =
      d.dominio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.tag_serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.dni_cuit.includes(searchTerm) ||
      (d.nombre_apellido && d.nombre_apellido.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.operador_runner && d.operador_runner.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStation = selectedStation === 'Todas' || d.estacion === selectedStation;

    return matchesSearch && matchesStation;
  });

  // Exportar a Excel (.xlsx) nativo
  const exportToExcel = () => {
    const excelData = filteredDeliveries.map((d) => ({
      'ID Registro': d.id,
      'Fecha y Hora': d.created_at ? new Date(d.created_at).toLocaleString('es-AR') : '',
      'Punto de Entrega': d.estacion,
      'Dominio / Patente': d.dominio,
      'Nº Serie TAG RFID': d.tag_serial,
      'DNI / CUIT': d.dni_cuit,
      'Nombre Receptor': d.nombre_apellido || 'N/A',
      'Usuario Registrador': d.operador_runner,
      'Observaciones': d.observaciones || '',
      'Sincronizado GLM': d.sincronizado_glm ? 'SÍ' : 'NO',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entregas TAG TelePASE');

    worksheet['!cols'] = [
      { wch: 36 },
      { wch: 20 },
      { wch: 22 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
      { wch: 22 },
      { wch: 30 },
      { wch: 15 },
    ];

    const fechaHoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Entregas_TAGs_CaminoSelva_${fechaHoy}.xlsx`);
  };

  // Exportar a CSV
  const exportToCSV = () => {
    const headers = 'ID,Fecha_Hora,Punto_de_Entrega,Dominio,TAG_Serial,DNI_CUIT,Nombre_Apellido,Usuario_Operador,Observaciones\n';
    const rows = filteredDeliveries
      .map((d) => `${d.id},${d.created_at},"${d.estacion}",${d.dominio},${d.tag_serial},${d.dni_cuit},"${d.nombre_apellido || ''}","${d.operador_runner}","${d.observaciones || ''}"`)
      .join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Entregas_TAGs_CaminoSelva_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  if (!userSession) {
    return <LoginForm onLoginSuccess={setUserSession} />;
  }

  const isAdmin = userSession.rol === 'Administrador' || !userSession.rol;

  return (
    <div className="min-h-screen bg-cs-bg text-slate-900 pb-12">
      {/* Header Navbar con Navegación y Perfil */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative h-11 w-44 sm:w-52 flex items-center">
              <img
                src="/logo.svg"
                alt="Camino Selva S.A."
                className="h-9 sm:h-11 w-auto object-contain"
              />
            </div>
            <div className="hidden md:block h-6 w-px bg-slate-300"></div>
            <div className="hidden md:block">
              <h1 className="font-bold text-xs uppercase tracking-wider text-cs-primary">
                Corredor Vial Noreste
              </h1>
              <p className="text-[11px] text-slate-500">Gestión & Control de TAGs TelePASE</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Pestañas de Navegación */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  activeTab === 'dashboard'
                    ? 'bg-cs-primary text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Entregas</span>
              </button>

              <button
                onClick={() => setActiveTab('transfers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  activeTab === 'transfers'
                    ? 'bg-cs-primary text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Movimientos</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => setActiveTab('settings_batches')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                      activeTab === 'settings_batches'
                        ? 'bg-cs-primary text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Alta de TAGs</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('settings_points')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                      activeTab === 'settings_points'
                        ? 'bg-cs-primary text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Puntos de Entrega</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('settings_users')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                      activeTab === 'settings_users'
                        ? 'bg-cs-primary text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Usuarios</span>
                  </button>
                </>
              )}
            </div>

            {/* Badge Usuario (Display de Rol y Punto de Entrega Asignado) */}
            <div
              className="flex items-center space-x-2 bg-slate-50 text-slate-800 text-xs px-3 py-1.5 rounded-xl border border-slate-200 text-left"
              title={`Usuario: ${userSession.nombre} | Rol: ${userSession.rol} | Punto de Entrega: ${userSession.punto_entrega || 'Todos'}`}
            >
              <User className="w-4 h-4 text-cs-primary" />
              <div className="flex flex-col text-left">
                <div className="flex items-center space-x-1">
                  <span className="font-bold text-slate-900 leading-tight">{userSession.nombre}</span>
                  {userSession.punto_entrega && (
                    <span className="text-[10px] text-emerald-800 bg-emerald-100 font-bold px-1.5 py-0.2 rounded">
                      {userSession.punto_entrega}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[9px] font-bold uppercase ${
                    isAdmin ? 'text-amber-700 font-extrabold' : 'text-teal-700'
                  }`}
                >
                  {userSession.rol || 'Operador'}
                </span>
              </div>
            </div>

            <button
              onClick={fetchData}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
              title="Recargar Datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cs-primary' : ''}`} />
            </button>

            <button
              onClick={handleLogout}
              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition flex items-center space-x-1 text-xs font-semibold"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6">
        {/* VISTA 1: MOVIMIENTOS Y TRANSFERENCIAS DE INVENTARIO */}
        {activeTab === 'transfers' && (
          <TransferManagement currentUser={userSession} onTransferUpdated={fetchData} />
        )}

        {/* VISTA 2: ALTA Y RECEPCIÓN DE LOTES DE TAGS (SOLO ADMIN) */}
        {activeTab === 'settings_batches' && isAdmin && (
          <BatchManagement currentUser={userSession} onBatchCreated={fetchData} />
        )}

        {/* VISTA 2: CONFIGURACIÓN Y ALTA DE PUNTOS DE ENTREGA (ADMINISTRADORES) */}
        {activeTab === 'settings_points' && isAdmin && (
          <DeliveryPointManagement onPointUpdated={fetchData} />
        )}

        {/* VISTA 3: CONFIGURACIÓN Y USUARIOS (ADMINISTRADORES) */}
        {activeTab === 'settings_users' && isAdmin && (
          <UserManagement />
        )}

        {/* VISTA 4: PANEL PRINCIPAL DE ENTREGAS Y STOCK */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Tarjetas de Stock por Punto de Entrega */}
            {stocks.length === 0 ? (
              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 text-center text-slate-500 font-medium text-xs flex items-center justify-center space-x-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>No hay Puntos de Entrega registrados. Ingrese a <b>Puntos de Entrega</b> en la barra superior para registrar sus estaciones.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-flow-col md:auto-cols-fr gap-3.5">
                {stocks.map((s) => {
                  const disponible = s.stock_recibido - s.stock_entregado;
                  const bajoStock = disponible <= s.stock_minimo_alerta;
                  const isMyPoint = userSession.punto_entrega === s.estacion;

                  return (
                    <div
                      key={s.estacion}
                      className={`p-3.5 rounded-2xl shadow-sm border transition relative ${
                        isMyPoint
                          ? 'bg-emerald-50/50 border-cs-primary ring-2 ring-cs-primary/30'
                          : 'bg-white border-slate-200/80 hover:border-cs-primary/40'
                      }`}
                    >
                      {isMyPoint && (
                        <span className="absolute -top-2.5 left-3 bg-cs-primary text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow-xs">
                          Mi Punto de Entrega
                        </span>
                      )}
                      <div className="flex items-center justify-between mb-1.5 gap-1">
                        <span
                          className="text-[11px] font-bold text-cs-primary uppercase tracking-wide truncate"
                          title={s.estacion}
                        >
                          {s.estacion}
                        </span>
                        {bajoStock ? (
                          <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-cs-primary flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                        {disponible.toLocaleString('es-AR')} <span className="text-xs font-normal text-slate-500">disp.</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between gap-1">
                        <span>Entregados: <b className="text-slate-800">{s.stock_entregado.toLocaleString('es-AR')}</b></span>
                        <span>Recibidos: <b className="text-slate-700">{s.stock_recibido.toLocaleString('es-AR')}</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Formulario + Tabla de Registros */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Formulario con usuario autenticado */}
              <div className="lg:col-span-5">
                <DeliveryForm currentUser={userSession} onDeliverySuccess={fetchData} />
              </div>

              {/* Listado Completo de Entregas con Exportación Excel */}
              <div className="lg:col-span-7 bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-cs-primary" />
                    <h3 className="font-bold text-base text-slate-900">Listado Completo de Entregas</h3>
                  </div>

                  {/* Botones de Exportación */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={exportToExcel}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
                      title="Descargar reporte en formato Excel (.xlsx)"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Descargar XLS</span>
                    </button>

                    <button
                      onClick={exportToCSV}
                      className="px-3 py-2 bg-cs-primary hover:bg-cs-dark text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
                      title="Descargar CSV para cruce GLM"
                    >
                      <Download className="w-4 h-4 text-cs-accent" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {/* Filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar por Patente, TAG, DNI, Usuario..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full p-2.5 pl-9 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cs-primary"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>

                  <select
                    value={selectedStation}
                    onChange={(e) => setSelectedStation(e.target.value)}
                    className="p-2.5 text-sm rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-cs-primary bg-slate-50 text-slate-800"
                  >
                    <option value="Todas">Todos los Puntos de Entrega</option>
                    {availableStations.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tabla con TODA la Información Registrada e Información del Usuario */}
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-cs-dark text-white sticky top-0 z-10">
                      <tr>
                        <th className="p-3">Fecha/Hora</th>
                        <th className="p-3">Punto de Entrega</th>
                        <th className="p-3">Patente *</th>
                        <th className="p-3">TAG Serial *</th>
                        <th className="p-3">DNI / CUIT *</th>
                        <th className="p-3">Nombre Receptor</th>
                        <th className="p-3">Usuario Registrador</th>
                        <th className="p-3">Observaciones</th>
                        {isAdmin && <th className="p-3 text-center">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredDeliveries.length === 0 ? (
                        <tr>
                          <td colSpan={isAdmin ? 9 : 8} className="p-6 text-center text-slate-400">
                            No se encontraron registros de entrega.
                          </td>
                        </tr>
                      ) : (
                        filteredDeliveries.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition">
                            <td className="p-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                              {item.created_at
                                ? new Date(item.created_at).toLocaleString('es-AR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '-'}
                            </td>
                            <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">{item.estacion}</td>
                            <td className="p-3 font-mono font-bold text-slate-900 bg-slate-50/50">{item.dominio}</td>
                            <td className="p-3 font-mono text-cs-primary font-bold">{item.tag_serial}</td>
                            <td className="p-3 font-semibold text-slate-800 font-mono">{item.dni_cuit}</td>
                            <td className="p-3 text-slate-700">{item.nombre_apellido || '-'}</td>
                            <td className="p-3 font-semibold text-slate-700 whitespace-nowrap bg-emerald-50/40 text-emerald-900">
                              {item.operador_runner}
                            </td>
                            <td className="p-3 text-slate-500 max-w-[150px] truncate">{item.observaciones || '-'}</td>
                            {isAdmin && (
                              <td className="p-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    onClick={() => handleStartEditDelivery(item)}
                                    className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                                    title="Editar entrega"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDelivery(item)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                                    title="Eliminar entrega"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Eliminar</span>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Edición de Entrega por Administrador */}
      {editingDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-cs-dark text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-cs-accent" />
                <h3 className="font-bold text-sm">Modificar Registro de Entrega</h3>
              </div>
              <button
                onClick={() => setEditingDelivery(null)}
                className="p-1 text-slate-300 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateDelivery} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-cs-primary uppercase mb-1">Punto de Entrega *</label>
                  <select
                    value={editEstacion}
                    onChange={(e) => setEditEstacion(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
                    required
                  >
                    {availableStations.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-cs-primary uppercase mb-1">Dominio / Patente *</label>
                  <input
                    type="text"
                    value={editDominio}
                    onChange={(e) => setEditDominio(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-xs uppercase focus:ring-2 focus:ring-cs-primary focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-cs-primary uppercase mb-1">TAG Serial *</label>
                  <input
                    type="text"
                    value={editTagSerial}
                    onChange={(e) => setEditTagSerial(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-xs uppercase focus:ring-2 focus:ring-cs-primary focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-cs-primary uppercase mb-1">DNI / CUIT *</label>
                  <input
                    type="text"
                    value={editDniCuit}
                    onChange={(e) => setEditDniCuit(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre Receptor (Opcional)</label>
                <input
                  type="text"
                  value={editNombreReceptor}
                  onChange={(e) => setEditNombreReceptor(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Observaciones (Opcional)</label>
                <input
                  type="text"
                  value={editObservaciones}
                  onChange={(e) => setEditObservaciones(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-cs-primary hover:bg-cs-dark text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center space-x-1.5 uppercase"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDelivery(null)}
                  className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition uppercase"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
