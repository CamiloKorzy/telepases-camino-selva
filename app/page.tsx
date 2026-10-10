'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { TagDelivery, PeajeStock, UserSession, TagBatch, TagTransfer } from '@/types/database';
import DeliveryForm from '@/components/DeliveryForm';
import LoginForm from '@/components/LoginForm';
import UserManagement from '@/components/UserManagement';
import BatchManagement from '@/components/BatchManagement';
import DeliveryPointManagement from '@/components/DeliveryPointManagement';
import TransferManagement from '@/components/TransferManagement';
import ScheduledReportModal from '@/components/ScheduledReportModal';
import { getMasterDeliveryPoints, getMasterDeliveryPointsSync, fixUserName, DEFAULT_BATCHES, DEFAULT_TRANSFERS } from '@/lib/deliveryPoints';
import ActivationDocManagement, { getActivationDocConfig, generateWhatsAppLink } from '@/components/ActivationDocManagement';
import AuditLogViewer from '@/components/AuditLogViewer';
import { Download, Search, RefreshCw, Layers, ShieldCheck, AlertTriangle, LogOut, User, FileSpreadsheet, LayoutDashboard, PlusCircle, Users, MapPin, Edit2, Trash2, X, Save, Truck, Mail, Phone, BarChart3, Calendar, Send, FileText, ShieldAlert } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import TagSeriesDetailModal from '@/components/TagSeriesDetailModal';
import { logUserAction } from '@/lib/auditLogger';

export default function AntigravityDashboard() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [deliveries, setDeliveries] = useState<TagDelivery[]>([]);
  const [stocks, setStocks] = useState<PeajeStock[]>([]);
  const [availableStations, setAvailableStations] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState<string>('Todas');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transfers' | 'settings_batches' | 'settings_points' | 'settings_users' | 'settings_docs' | 'settings_audit'>('dashboard');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [selectedSeriesStation, setSelectedSeriesStation] = useState<string>('Todas');

  const docConfig = useMemo(() => getActivationDocConfig(), [activeTab]);

  // Filtros temporales para indicadores y grilla (Default: Todos)
  const [dateFilterMode, setDateFilterMode] = useState<'todos' | 'hoy' | 'semana' | 'mes' | 'rango'>('todos');
  const [customFechaDesde, setCustomFechaDesde] = useState<string>('');
  const [customFechaHasta, setCustomFechaHasta] = useState<string>('');

  // Estado para edición de entrega por Administrador
  const [editingDelivery, setEditingDelivery] = useState<TagDelivery | null>(null);
  const [editEstacion, setEditEstacion] = useState('');
  const [editDominio, setEditDominio] = useState('');
  const [editTagSerial, setEditTagSerial] = useState('');
  const [editDniCuit, setEditDniCuit] = useState('');
  const [editNombreReceptor, setEditNombreReceptor] = useState('');
  const [editObservaciones, setEditObservaciones] = useState('');
  const [editEmailContacto, setEditEmailContacto] = useState('');
  const [editCelularContacto, setEditCelularContacto] = useState('');

  // Cargar sesión al iniciar y escuchar actualizaciones
  const syncSession = () => {
    const stored = localStorage.getItem('telepase_user_session');
    if (stored) {
      try {
        const session: UserSession = JSON.parse(stored);
        if (session.activo !== false) {
          session.nombre = fixUserName(session.nombre);
          if (!session.rol) {
            session.rol = 'Administrador';
          }
          localStorage.setItem('telepase_user_session', JSON.stringify(session));
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

  // Escuchador silencioso en segundo plano para restaurar entregas y datos del dominio anterior
  useEffect(() => {
    const handleBridgeMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'TELEPASE_BRIDGE_PAYLOAD') {
        const payload = event.data.payload;
        if (!payload || typeof payload !== 'object') return;

        let dataMerged = false;

        // 1. Mergear Entregas
        if (Array.isArray(payload['telepase_local_tag_deliveries']) && payload['telepase_local_tag_deliveries'].length > 0) {
          const currentDeliveriesRaw = localStorage.getItem('telepase_local_tag_deliveries');
          const currentDeliveries: TagDelivery[] = currentDeliveriesRaw ? JSON.parse(currentDeliveriesRaw) : [];
          const incomingDeliveries: TagDelivery[] = payload['telepase_local_tag_deliveries'];

          const deliveryMap = new Map<string, TagDelivery>();
          [...incomingDeliveries, ...currentDeliveries].forEach((d) => {
            if (!d) return;
            const key = d.id || d.tag_serial || `${d.estacion}_${d.dominio}`;
            if (!deliveryMap.has(key)) deliveryMap.set(key, d);
          });
          const merged = Array.from(deliveryMap.values());
          localStorage.setItem('telepase_local_tag_deliveries', JSON.stringify(merged));
          dataMerged = true;
        }

        // 2. Mergear Lotes
        if (Array.isArray(payload['telepase_local_tag_batches']) && payload['telepase_local_tag_batches'].length > 0) {
          const currentBatchesRaw = localStorage.getItem('telepase_local_tag_batches');
          const currentBatches: TagBatch[] = currentBatchesRaw ? JSON.parse(currentBatchesRaw) : [];
          const incomingBatches: TagBatch[] = payload['telepase_local_tag_batches'];

          const batchMap = new Map<string, TagBatch>();
          [...incomingBatches, ...currentBatches].forEach((b) => {
            if (!b) return;
            const key = b.id || `${b.estacion}_${b.serial_desde}_${b.serial_hasta}`;
            if (!batchMap.has(key)) batchMap.set(key, b);
          });
          const merged = Array.from(batchMap.values());
          localStorage.setItem('telepase_local_tag_batches', JSON.stringify(merged));
          dataMerged = true;
        }

        // 3. Mergear Transferencias
        if (Array.isArray(payload['telepase_local_tag_transfers']) && payload['telepase_local_tag_transfers'].length > 0) {
          const currentTransfersRaw = localStorage.getItem('telepase_local_tag_transfers');
          const currentTransfers: TagTransfer[] = currentTransfersRaw ? JSON.parse(currentTransfersRaw) : [];
          const incomingTransfers: TagTransfer[] = payload['telepase_local_tag_transfers'];

          const transferMap = new Map<string, TagTransfer>();
          [...incomingTransfers, ...currentTransfers].forEach((t) => {
            if (!t) return;
            const key = t.id || `${t.origen}_${t.destino}_${t.serial_desde}_${t.serial_hasta}`;
            if (!transferMap.has(key)) transferMap.set(key, t);
          });
          const merged = Array.from(transferMap.values());
          localStorage.setItem('telepase_local_tag_transfers', JSON.stringify(merged));
          dataMerged = true;
        }

        if (dataMerged) {
          fetchData();
        }
      }
    };

    window.addEventListener('message', handleBridgeMessage);
    return () => window.removeEventListener('message', handleBridgeMessage);
  }, []);

  const fetchData = async () => {
    // -------------------------------------------------------------
    // FASE 1: Carga ULTRA-RÁPIDA (0ms) desde LocalStorage
    // -------------------------------------------------------------
    // FASE 0: Limpieza Inicial de Entregas para inicio limpio de la Base de Datos
    // -------------------------------------------------------------
    if (typeof window !== 'undefined' && localStorage.getItem('telepase_deliveries_wiped_v20261010') !== 'true') {
      localStorage.removeItem('telepase_local_tag_deliveries');
      localStorage.setItem('telepase_deliveries_wiped_v20261010', 'true');
      (async () => {
        try {
          await supabase.from('tag_deliveries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        } catch {}
      })();
    }

    let localDeliveries: TagDelivery[] = [];
    let localBatches: TagBatch[] = [];
    let localTransfers: TagTransfer[] = [];

    const storedLocalDeliveries = localStorage.getItem('telepase_local_tag_deliveries');
    if (storedLocalDeliveries) {
      try {
        localDeliveries = JSON.parse(storedLocalDeliveries);
      } catch {}
    }

    const storedBatches = localStorage.getItem('telepase_local_tag_batches');
    if (storedBatches) {
      try {
        localBatches = JSON.parse(storedBatches);
      } catch {}
    }

    const totalBatchQty = localBatches.reduce((acc, b) => acc + (Number(b?.cantidad) || 0), 0);
    const isComplete20kBatches = localBatches.length >= 14 && totalBatchQty >= 20000;

    if (localBatches.length === 0 || !isComplete20kBatches) {
      localBatches = DEFAULT_BATCHES;
      try {
        localStorage.setItem('telepase_local_tag_batches', JSON.stringify(localBatches));
      } catch {}
    }

    const storedTransfers = localStorage.getItem('telepase_local_tag_transfers');
    if (storedTransfers) {
      try {
        localTransfers = JSON.parse(storedTransfers);
      } catch {}
    }

    const totalTransfQty = localTransfers.reduce((acc, t) => acc + (Number(t?.cantidad) || 0), 0);
    const isCompleteTransfers = localTransfers.length >= 4 && totalTransfQty >= 6000;

    if (localTransfers.length === 0 || !isCompleteTransfers) {
      localTransfers = DEFAULT_TRANSFERS;
      try {
        localStorage.setItem('telepase_local_tag_transfers', JSON.stringify(localTransfers));
      } catch {}
    }

    const masterPoints = getMasterDeliveryPointsSync();
    const stationNamesList = masterPoints.map((p) => p.estacion).filter(Boolean);

    const computeStocks = (
      pointsList: PeajeStock[],
      batchesList: TagBatch[],
      transfersList: TagTransfer[],
      deliveriesList: TagDelivery[]
    ): PeajeStock[] => {
      return pointsList
        .filter((pt) => pt && pt.estacion)
        .map((pt) => {
          const st = pt.estacion.trim();
          const stLower = st.toLowerCase();

          const lotesEstacion = batchesList.filter((b) => b && b.estacion && b.estacion.trim().toLowerCase() === stLower);
          const totalRecibidoLotes = lotesEstacion.reduce((acc, b) => acc + (Number(b.cantidad) || 0), 0);

          const transfRecibidas = transfersList.filter(
            (t) => t && t.destino && t.destino.trim().toLowerCase() === stLower && t.estado === 'Recibido'
          );
          const totalRecibidoTransf = transfRecibidas.reduce((acc, t) => acc + (Number(t.cantidad) || 0), 0);
          const totalStockRecibido = totalRecibidoLotes + totalRecibidoTransf;

          const transfEnviadas = transfersList.filter(
            (t) => t && t.origen && t.origen.trim().toLowerCase() === stLower && t.estado !== 'Cancelado'
          );
          const totalEnviadoTransf = transfEnviadas.reduce((acc, t) => acc + (Number(t.cantidad) || 0), 0);

          const entregadosVia = deliveriesList.filter((d) => d && d.estacion && d.estacion.trim().toLowerCase() === stLower).length;
          const totalStockSalidas = entregadosVia + totalEnviadoTransf;

          const transfPendientesRecepcion = transfersList.filter(
            (t) => t && t.destino && t.destino.trim().toLowerCase() === stLower && t.estado === 'En Tránsito'
          );
          const totalPendientesRecepcion = transfPendientesRecepcion.reduce(
            (acc, t) => acc + (Number(t.cantidad) || 0),
            0
          );

          return {
            estacion: st,
            stock_recibido: totalStockRecibido,
            stock_entregado: totalStockSalidas,
            stock_minimo_alerta: pt.stock_minimo_alerta || 100,
            pendientes_recepcion: totalPendientesRecepcion,
            email_notificacion: pt.email_notificacion,
          };
        });
    };

    // Renderizar INMEDIATAMENTE datos locales en React State (0ms)
    const initialStocks = computeStocks(masterPoints, localBatches, localTransfers, localDeliveries);
    setDeliveries(localDeliveries);
    setAvailableStations(stationNamesList);
    setStocks(initialStocks);
    setLoading(false);

    // -------------------------------------------------------------
    // FASE 2: Sincronización PARALELA en Segundo Plano con Timeout
    // -------------------------------------------------------------
    try {
      const timeoutMs = 1200;
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

      const [resPoints, resDeliveries, resBatches, resTransfers] = await Promise.all([
        Promise.race([supabase.from('peaje_stock').select('*').order('estacion', { ascending: true }), timeoutPromise]),
        Promise.race([supabase.from('tag_deliveries').select('*').order('created_at', { ascending: false }).limit(500), timeoutPromise]),
        Promise.race([supabase.from('tag_batches').select('*'), timeoutPromise]),
        Promise.race([supabase.from('tag_transfers').select('*'), timeoutPromise]),
      ]);

      let remotePoints: PeajeStock[] = masterPoints;
      if (resPoints && resPoints.data && Array.isArray(resPoints.data) && resPoints.data.length > 0) {
        const pointMap = new Map<string, PeajeStock>();
        masterPoints.forEach((p) => pointMap.set(p.estacion.toLowerCase(), p));
        resPoints.data.forEach((p: PeajeStock) => {
          if (p && p.estacion) {
            const key = p.estacion.toLowerCase();
            const existing = pointMap.get(key);
            pointMap.set(key, { ...existing, ...p });
          }
        });
        remotePoints = Array.from(pointMap.values());
      }

      let remoteDeliveries: TagDelivery[] = [];
      if (resDeliveries && resDeliveries.data && Array.isArray(resDeliveries.data)) {
        remoteDeliveries = resDeliveries.data;
      }

      let remoteBatches: TagBatch[] = [];
      if (resBatches && resBatches.data && Array.isArray(resBatches.data)) {
        remoteBatches = resBatches.data;
      }

      let remoteTransfers: TagTransfer[] = [];
      if (resTransfers && resTransfers.data && Array.isArray(resTransfers.data)) {
        remoteTransfers = resTransfers.data;
      }

      // Combinar Entregas
      const deliveryMap = new Map<string, TagDelivery>();
      [...localDeliveries, ...remoteDeliveries].forEach((d) => {
        if (!d) return;
        const key = d.id || d.tag_serial || `${d.estacion}_${d.dominio}`;
        if (key && !deliveryMap.has(key)) deliveryMap.set(key, d);
      });
      const mergedDeliveries = Array.from(deliveryMap.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      // Combinar Lotes
      const batchMap = new Map<string, TagBatch>();
      [...remoteBatches, ...localBatches].forEach((b) => {
        if (!b) return;
        const key = b.id || `${b.estacion}_${b.serial_desde}_${b.serial_hasta}`;
        if (!batchMap.has(key)) batchMap.set(key, b);
      });
      let mergedBatches = Array.from(batchMap.values());
      if (mergedBatches.length === 0) {
        mergedBatches = DEFAULT_BATCHES;
      }

      // Combinar Transferencias
      const transferMap = new Map<string, TagTransfer>();
      [...remoteTransfers, ...localTransfers].forEach((t) => {
        if (!t) return;
        const key = t.id || `${t.origen}_${t.destino}_${t.serial_desde}_${t.serial_hasta}`;
        if (!transferMap.has(key)) transferMap.set(key, t);
      });
      const mergedTransfers = Array.from(transferMap.values());

      const updatedStationsList = remotePoints.map((p) => p.estacion).filter(Boolean);
      const finalStocks = computeStocks(remotePoints, mergedBatches, mergedTransfers, mergedDeliveries);

      setDeliveries(mergedDeliveries);
      setAvailableStations(updatedStationsList);
      setStocks(finalStocks);
    } catch (err) {
      console.warn('Sincronización remota completada con advertencias:', err);
    }
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
    if (userSession) {
      logUserAction(
        userSession,
        'CIERRE_SESION',
        'Autenticación',
        `Cierre de sesión de ${userSession.nombre} (${userSession.email})`
      );
    }
    localStorage.removeItem('telepase_user_session');
    supabase.auth.signOut();
    setUserSession(null);
  };

  const handleStartEditDelivery = (item: TagDelivery) => {
    if (userSession?.rol !== 'Administrador') return;
    setEditingDelivery(item);
    setEditEstacion(item.estacion);
    setEditDominio(item.dominio);
    setEditTagSerial(item.tag_serial);
    setEditDniCuit(item.dni_cuit);
    setEditNombreReceptor(item.nombre_apellido || '');
    setEditObservaciones(item.observaciones || '');
    setEditEmailContacto(item.email_contacto || '');
    setEditCelularContacto(item.celular_contacto || '');
  };

  const handleUpdateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery || userSession?.rol !== 'Administrador') return;

    const updatedPayload: TagDelivery = {
      ...editingDelivery,
      estacion: editEstacion,
      dominio: editDominio.toUpperCase().replace(/\s/g, ''),
      tag_serial: editTagSerial.trim().toUpperCase(),
      dni_cuit: editDniCuit.trim(),
      nombre_apellido: editNombreReceptor.trim(),
      observaciones: editObservaciones.trim(),
      email_contacto: editEmailContacto.trim(),
      celular_contacto: editCelularContacto.trim(),
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

    logUserAction(
      userSession,
      'EDICION_ENTREGA',
      'Entregas',
      `Edición de entrega TAG ${editTagSerial} - Vehículo Dominio: ${editDominio} (DNI/CUIT: ${editDniCuit})`
    );

    setEditingDelivery(null);
    fetchData();
  };

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

  const handleDeleteDelivery = (item: TagDelivery) => {
    if (userSession?.rol !== 'Administrador') return;
    setConfirmModalState({
      isOpen: true,
      title: 'Eliminar Entrega de TAG',
      message: `¿Está seguro de que desea eliminar el registro de entrega del TAG ${item.tag_serial} (Vehículo Dominio ${item.dominio})?`,
      confirmText: 'Sí, Eliminar Registro',
      type: 'danger',
      icon: 'trash',
      onConfirm: async () => {
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

        logUserAction(
          userSession,
          'ELIMINACION_ENTREGA',
          'Entregas',
          `Eliminación de entrega TAG ${item.tag_serial} - Vehículo Dominio: ${item.dominio}`
        );

        fetchData();
      },
    });
  };

  const handleClearAllDeliveries = () => {
    if (userSession?.rol !== 'Administrador') return;
    setConfirmModalState({
      isOpen: true,
      title: 'Limpiar Todo el Historial de Entregas',
      message: '¿Está seguro de que desea ELIMINAR TODAS LAS ENTREGAS DE TAGS registradas? Esta acción vaciará la base de datos de entregas para iniciar el sistema desde cero. Los lotes, transferencias y usuarios permanecerán intactos.',
      confirmText: 'Sí, Eliminar Todas las Entregas',
      type: 'danger',
      icon: 'trash',
      onConfirm: async () => {
        try {
          await supabase.from('tag_deliveries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        } catch {}

        localStorage.removeItem('telepase_local_tag_deliveries');
        setDeliveries([]);

        logUserAction(
          userSession,
          'LIMPIEZA_ENTREGAS',
          'Entregas',
          `Limpieza completa del historial de entregas realizada por Administrador ${userSession.nombre}`
        );

        fetchData();
      },
    });
  };

  const isDateInFilter = (dateStr: string | undefined, filterMode: string, customDesde: string, customHasta: string): boolean => {
    if (!dateStr) return false;
    if (filterMode === 'todos') return true;

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filterMode === 'hoy') {
      return d >= startOfToday && d <= endOfToday;
    }

    if (filterMode === 'semana') {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      return d >= startOfWeek && d <= endOfToday;
    }

    if (filterMode === 'mes') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return d >= startOfMonth && d <= endOfToday;
    }

    if (filterMode === 'rango') {
      let matches = true;
      if (customDesde) {
        const fromDate = new Date(customDesde + 'T00:00:00');
        if (!isNaN(fromDate.getTime())) {
          matches = matches && d >= fromDate;
        }
      }
      if (customHasta) {
        const toDate = new Date(customHasta + 'T23:59:59');
        if (!isNaN(toDate.getTime())) {
          matches = matches && d <= toDate;
        }
      }
      return matches;
    }

    return true;
  };

  // Entregas filtradas por período para indicadores
  const periodDeliveries = (deliveries || []).filter((d) =>
    isDateInFilter(d?.created_at, dateFilterMode, customFechaDesde, customFechaHasta)
  );

  const totalPeriodDeliveries = periodDeliveries.length;

  const deliveriesByStation = availableStations.map((st) => {
    const count = periodDeliveries.filter((d) => d && d.estacion && d.estacion.trim().toLowerCase() === st.trim().toLowerCase()).length;
    return { estacion: st, count };
  });

  // Filtrado completo para grilla y exportación
  const filteredDeliveries = (deliveries || []).filter((d) => {
    if (!d) return false;
    const term = (searchTerm || '').toLowerCase().trim();
    const dom = (d.dominio || '').toLowerCase();
    const tag = (d.tag_serial || '').toLowerCase();
    const dni = (d.dni_cuit || '');
    const nom = (d.nombre_apellido || '').toLowerCase();
    const ope = (d.operador_runner || '').toLowerCase();

    const matchesSearch =
      !term ||
      dom.includes(term) ||
      tag.includes(term) ||
      dni.includes(term) ||
      nom.includes(term) ||
      ope.includes(term);

    const matchesStation = selectedStation === 'Todas' || d.estacion === selectedStation;
    const matchesDate = isDateInFilter(d.created_at, dateFilterMode, customFechaDesde, customFechaHasta);

    return matchesSearch && matchesStation && matchesDate;
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
      'Email Contacto (Folleto)': d.email_contacto || '-',
      'Celular Contacto (SMS/WhatsApp)': d.celular_contacto || '-',
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
      { wch: 26 },
      { wch: 22 },
      { wch: 22 },
      { wch: 30 },
      { wch: 15 },
    ];

    const fechaHoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Entregas_TAGs_CaminoSelva_${fechaHoy}.xlsx`);
  };

  // Exportar a CSV
  const exportToCSV = () => {
    const headers = 'ID,Fecha_Hora,Punto_de_Entrega,Dominio,TAG_Serial,DNI_CUIT,Nombre_Apellido,Email_Contacto,Celular_Contacto,Usuario_Operador,Observaciones\n';
    const rows = filteredDeliveries
      .map((d) => `${d.id},${d.created_at},"${d.estacion}",${d.dominio},${d.tag_serial},${d.dni_cuit},"${d.nombre_apellido || ''}","${d.email_contacto || ''}","${d.celular_contacto || ''}","${d.operador_runner}","${d.observaciones || ''}"`)
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

                  <button
                    onClick={() => setActiveTab('settings_docs')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                      activeTab === 'settings_docs'
                        ? 'bg-cs-primary text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Docs & Envíos</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('settings_audit')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                      activeTab === 'settings_audit'
                        ? 'bg-cs-primary text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Auditoría</span>
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
                    userSession.rol === 'Consulta'
                      ? 'text-sky-700 font-extrabold bg-sky-100 px-1.5 py-0.5 rounded border border-sky-300'
                      : isAdmin
                      ? 'text-amber-700 font-extrabold'
                      : 'text-teal-700'
                  }`}
                >
                  {userSession.rol === 'Consulta' ? 'CONSULTA (SOLO LECTURA)' : userSession.rol || 'Operador'}
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

        {/* VISTA 5: CONFIGURACIÓN DE DOCUMENTOS DE ACTIVACIÓN Y ENVÍOS (ADMINISTRADORES) */}
        {activeTab === 'settings_docs' && isAdmin && (
          <ActivationDocManagement />
        )}

        {/* VISTA 6: LOGS DE AUDITORÍA DE OPERACIONES (SOLO ADMINISTRADORES) */}
        {activeTab === 'settings_audit' && isAdmin && (
          <AuditLogViewer currentUser={userSession} />
        )}

        {/* VISTA 4: PANEL PRINCIPAL DE ENTREGAS Y STOCK */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Header de Indicadores de Stock con Selector de Período Temporal */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center justify-between w-full md:w-auto gap-3">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-cs-primary" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Estado de Inventario por Punto de Entrega</h3>
                    <p className="text-[11px] text-slate-500">
                      Métricas de stock disponible y entregas según el período seleccionado
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      logUserAction(
                        userSession,
                        'CONSULTA_SERIES_TAGS',
                        'Series & Auditoría',
                        'Consulta de detalle de series de TAGs por Punto de Entrega'
                      );
                      setSelectedSeriesStation('Todas');
                      setIsSeriesModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-cs-primary hover:bg-emerald-950 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs flex-shrink-0"
                    title="Ver el detalle completo de series y rangos de TAGs por Punto de Entrega (Exclusivo Administrador)"
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Ver Series de TAGs</span>
                  </button>
                )}
              </div>

              {/* Selector de Período Temporal */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold border border-slate-200">
                  <button
                    onClick={() => setDateFilterMode('todos')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      dateFilterMode === 'todos' ? 'bg-cs-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setDateFilterMode('hoy')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      dateFilterMode === 'hoy' ? 'bg-cs-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() => setDateFilterMode('semana')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      dateFilterMode === 'semana' ? 'bg-cs-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => setDateFilterMode('mes')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      dateFilterMode === 'mes' ? 'bg-cs-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Mes
                  </button>
                  <button
                    onClick={() => setDateFilterMode('rango')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      dateFilterMode === 'rango' ? 'bg-cs-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Rango de Fechas
                  </button>
                </div>

                {dateFilterMode === 'rango' && (
                  <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
                    <input
                      type="date"
                      value={customFechaDesde}
                      onChange={(e) => setCustomFechaDesde(e.target.value)}
                      className="p-1.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                    />
                    <span className="text-slate-400 font-bold">a</span>
                    <input
                      type="date"
                      value={customFechaHasta}
                      onChange={(e) => setCustomFechaHasta(e.target.value)}
                      className="p-1.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

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
                  const entregadosPeriodo = (deliveries || []).filter(
                    (d) =>
                      d &&
                      d.estacion &&
                      d.estacion.trim().toLowerCase() === s.estacion.trim().toLowerCase() &&
                      isDateInFilter(d.created_at, dateFilterMode, customFechaDesde, customFechaHasta)
                  ).length;

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
                        <span>Entregados: <b className="text-slate-800">{entregadosPeriodo.toLocaleString('es-AR')}</b></span>
                        <span>Recibidos: <b className="text-slate-700">{s.stock_recibido.toLocaleString('es-AR')}</b></span>
                      </div>

                      <div
                        onClick={() => setActiveTab('transfers')}
                        className={`mt-2 pt-1.5 border-t flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                          (s.pendientes_recepcion || 0) > 0
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 border shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60 border'
                        }`}
                        title="Ver Transferencias y Pendientes de Recepción"
                      >
                        <span className="flex items-center space-x-1">
                          <Truck className={`w-3 h-3 ${(s.pendientes_recepcion || 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                          <span>Pend. Recepción:</span>
                        </span>
                        <b className={(s.pendientes_recepcion || 0) > 0 ? 'text-amber-800 font-black' : 'text-slate-700'}>
                          {(s.pendientes_recepcion || 0).toLocaleString('es-AR')}
                        </b>
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            logUserAction(
                              userSession,
                              'CONSULTA_SERIES_ESTACION',
                              'Series & Auditoría',
                              `Consulta de detalle de series de TAGs para estación: ${s.estacion}`
                            );
                            setSelectedSeriesStation(s.estacion);
                            setIsSeriesModalOpen(true);
                          }}
                          className="mt-1.5 w-full flex items-center justify-center space-x-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-cs-primary border border-emerald-200/80 rounded-lg text-[10px] font-extrabold transition"
                          title={`Ver detalle de series de TAGs asignados a ${s.estacion} (Exclusivo Administrador)`}
                        >
                          <Layers className="w-3 h-3 text-emerald-600" />
                          <span>Ver Series ({disponible.toLocaleString('es-AR')} disp.)</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Formulario / Grilla Detalle de Entregas en Ancho Completo */}
            <div className="space-y-6">
              {/* Formulario con usuario autenticado (Oculto para Rol Consulta) */}
              {userSession.rol !== 'Consulta' && (
                <div className="w-full">
                  <DeliveryForm currentUser={userSession} onDeliverySuccess={fetchData} />
                </div>
              )}

              {/* Listado Completo de Entregas (Ancho Completo de Pantalla) */}
              <div className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
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

                    {isAdmin && (
                      <button
                        onClick={handleClearAllDeliveries}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition"
                        title="Limpiar todo el historial de entregas de la base de datos (Exclusivo Administrador)"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Limpiar Entregas</span>
                      </button>
                    )}
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
                        <th className="p-3">Contacto (Mail / Cel)</th>
                        <th className="p-3">Usuario Registrador</th>
                        <th className="p-3">Observaciones</th>
                        {isAdmin && <th className="p-3 text-center">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredDeliveries.length === 0 ? (
                        <tr>
                          <td colSpan={isAdmin ? 10 : 9} className="p-6 text-center text-slate-400">
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
                            <td className="p-3 text-slate-700 font-mono text-[11px]">
                              {item.email_contacto || item.celular_contacto ? (
                                <div className="space-y-1">
                                  {item.email_contacto && (
                                    <div className="flex items-center space-x-1">
                                      <a
                                        href={`mailto:${item.email_contacto}?subject=${encodeURIComponent(docConfig.email_subject || 'Folleto TelePASE')}&body=${encodeURIComponent(
                                          (docConfig.email_body_template || '')
                                            .replace(/{NOMBRE}/g, item.nombre_apellido || '')
                                            .replace(/{DOMINIO}/g, item.dominio)
                                            .replace(/{TAG}/g, item.tag_serial)
                                            .replace(/{ESTACION}/g, item.estacion)
                                        )}`}
                                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold text-[10px] transition border ${
                                          docConfig.email_active
                                            ? 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
                                            : 'bg-slate-100 text-slate-500 border-slate-200 line-through opacity-70'
                                        }`}
                                        title={docConfig.email_active ? "Enviar Folleto e Instrucciones por Email" : "Envíos por Email Deshabilitados en Configuración"}
                                      >
                                        <Mail className="w-3 h-3 text-sky-600 flex-shrink-0" />
                                        <span className="truncate max-w-[120px]">{item.email_contacto}</span>
                                      </a>
                                    </div>
                                  )}
                                  {item.celular_contacto && (
                                    <div className="flex items-center space-x-1">
                                      <a
                                        href={docConfig.whatsapp_active ? generateWhatsAppLink(item.celular_contacto, item.nombre_apellido || '', item.dominio, item.tag_serial, item.estacion, docConfig) : '#'}
                                        target={docConfig.whatsapp_active ? "_blank" : "_self"}
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-bold text-[10px] transition border ${
                                          docConfig.whatsapp_active
                                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                                            : 'bg-slate-100 text-slate-500 border-slate-200 line-through opacity-70 cursor-not-allowed'
                                        }`}
                                        title={docConfig.whatsapp_active ? "Enviar Folleto e Instrucciones por WhatsApp" : "Envíos por WhatsApp Deshabilitados en Configuración"}
                                      >
                                        <Send className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                        <span>{item.celular_contacto}</span>
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="p-3 font-semibold text-slate-700 whitespace-nowrap bg-emerald-50/40 text-emerald-900">
                              {fixUserName(item.operador_runner)}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-sky-50/50 p-3 rounded-xl border border-sky-100">
                <div>
                  <label className="block text-[11px] font-bold text-sky-900 uppercase mb-1 flex items-center space-x-1">
                    <Mail className="w-3.5 h-3.5 text-sky-600" />
                    <span>Email Contacto (Folleto)</span>
                  </label>
                  <input
                    type="email"
                    value={editEmailContacto}
                    onChange={(e) => setEditEmailContacto(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full p-2.5 rounded-xl border border-sky-200 text-xs bg-white text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-sky-900 uppercase mb-1 flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5 text-sky-600" />
                    <span>Celular / WhatsApp (Activación)</span>
                  </label>
                  <input
                    type="tel"
                    value={editCelularContacto}
                    onChange={(e) => setEditCelularContacto(e.target.value)}
                    placeholder="3764123456"
                    className="w-full p-2.5 rounded-xl border border-sky-200 text-xs bg-white text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
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

      <ScheduledReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        stocks={stocks}
      />

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

      <TagSeriesDetailModal
        isOpen={isSeriesModalOpen}
        onClose={() => setIsSeriesModalOpen(false)}
        initialStation={selectedSeriesStation}
        availableStations={availableStations}
      />

      {/* Invisible Sync Bridge IFrames to auto-restore data from previous Vercel deployment domains */}
      <iframe
        src="https://telepases-camino-selva-3vc4bwl18-camiloks-projects.vercel.app/sync-bridge"
        style={{ display: 'none', width: 0, height: 0, border: 0 }}
      />
      <iframe
        src="https://telepases-camino-selva.vercel.app/sync-bridge"
        style={{ display: 'none', width: 0, height: 0, border: 0 }}
      />
    </div>
  );
}
