'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, PeajeStock } from '@/types/database';
import { UserPlus, Shield, UserCheck, UserX, AlertCircle, CheckCircle2, RefreshCw, Key, Info, Edit, X, Save, MapPin } from 'lucide-react';
import { getMasterDeliveryPoints, fixUserName } from '@/lib/deliveryPoints';
import { logUserAction } from '@/lib/auditLogger';
import ConfirmModal from '@/components/ConfirmModal';

const LOCAL_USERS_KEY = 'telepase_registered_user_profiles';

const DEFAULT_USERS: UserProfile[] = [
  {
    id: '1',
    email: 'camilo.k@ceeenriquez.com',
    nombre: 'Camilo Korzyniewski',
    password_hash: 'admin123',
    rol: 'Administrador',
    punto_entrega: 'Todos',
    activo: true,
  },
  {
    id: '2',
    email: 'admin@caminoselva.com',
    nombre: 'Administrador General',
    password_hash: 'admin123',
    rol: 'Administrador',
    punto_entrega: 'Todos',
    activo: true,
  },
  {
    id: '3',
    email: 'camilo.k@caminoselva.com',
    nombre: 'Camilo Korzyniewski',
    password_hash: 'admin123',
    rol: 'Administrador',
    punto_entrega: 'Santa Ana',
    activo: true,
  },
  {
    id: '4',
    email: 'peaje.santa.ana@caminoselva.com',
    nombre: 'Peaje Santa Ana',
    password_hash: 'op123456',
    rol: 'Operador',
    punto_entrega: 'Santa Ana',
    activo: true,
  },
  {
    id: '5',
    email: 'consulta@caminoselva.com',
    nombre: 'Auditor / Consulta Inventario',
    password_hash: 'consulta123',
    rol: 'Consulta',
    punto_entrega: 'Todos',
    activo: true,
  },
  {
    id: '6',
    email: 'peaje.victoria@caminoselva.com',
    nombre: 'Peaje Colonia Victoria',
    password_hash: 'op123456',
    rol: 'Operador',
    punto_entrega: 'Colonia Victoria',
    activo: true,
  },
  {
    id: '7',
    email: 'peaje.fachinal@caminoselva.com',
    nombre: 'Peaje Fachinal',
    password_hash: 'op123456',
    rol: 'Operador',
    punto_entrega: 'Paraje Fachinal',
    activo: true,
  },
  {
    id: '8',
    email: 'peaje.ituzaingo@caminoselva.com',
    nombre: 'Peaje Ituzaingó',
    password_hash: 'op123456',
    rol: 'Operador',
    punto_entrega: 'Ituzaingó',
    activo: true,
  },
  {
    id: '9',
    email: 'oficina.central@caminoselva.com',
    nombre: 'Oficina Central',
    password_hash: 'admin123',
    rol: 'Operador',
    punto_entrega: 'Oficina Central',
    activo: true,
  },
];

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deliveryPoints, setDeliveryPoints] = useState<string[]>([
    'Santa Ana',
    'Colonia Victoria',
    'Paraje Fachinal',
    'Ituzaingó',
  ]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulario nuevo usuario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<'Administrador' | 'Operador' | 'Consulta'>('Operador');
  const [puntoEntrega, setPuntoEntrega] = useState<string>('Santa Ana');

  // Estado para usuario en edición
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRol, setEditRol] = useState<'Administrador' | 'Operador' | 'Consulta'>('Operador');
  const [editPuntoEntrega, setEditPuntoEntrega] = useState<string>('Santa Ana');

  // Cargar Puntos de Entrega dinámicos desde el maestro
  const loadDeliveryPoints = async () => {
    const masterList = await getMasterDeliveryPoints();
    const names = masterList.map((p) => p.estacion);
    setDeliveryPoints(names);
  };

  useEffect(() => {
    const handleUpdated = () => loadDeliveryPoints();
    window.addEventListener('delivery_points_updated', handleUpdated);
    return () => window.removeEventListener('delivery_points_updated', handleUpdated);
  }, []);

  const fetchUsers = async () => {
    // 1. Cargar desde almacenamiento local para renderizado instantáneo (0ms)
    let localUsers: UserProfile[] = [];
    const stored = localStorage.getItem(LOCAL_USERS_KEY);
    if (stored) {
      try {
        localUsers = JSON.parse(stored);
      } catch {
        localUsers = DEFAULT_USERS;
      }
    } else {
      localUsers = DEFAULT_USERS;
    }

    localUsers = localUsers.map((u) => ({ ...u, nombre: fixUserName(u.nombre) }));

    if (!localUsers.some((u) => u.email === 'camilo.k@ceeenriquez.com')) {
      localUsers.unshift(DEFAULT_USERS[0]);
    }

    setUsers(localUsers);
    setLoading(false);
    loadDeliveryPoints();

    // 2. Sincronizar cola pendiente de usuarios locales con Supabase si hay red
    try {
      const pendingSyncsRaw = localStorage.getItem('telepase_pending_user_syncs');
      if (pendingSyncsRaw) {
        const pendingSyncs: UserProfile[] = JSON.parse(pendingSyncsRaw);
        if (pendingSyncs.length > 0) {
          await supabase.from('user_profiles').upsert(
            pendingSyncs.map((u) => ({
              email: u.email.toLowerCase(),
              nombre: fixUserName(u.nombre),
              password_hash: u.password_hash,
              rol: u.rol,
              punto_entrega: u.punto_entrega,
              activo: u.activo,
            })),
            { onConflict: 'email' }
          );
          localStorage.removeItem('telepase_pending_user_syncs');
        }
      }
    } catch {}

    // 3. Consultar Supabase como Fuente de Verdad principal
    try {
      const { data: dbUsers, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && dbUsers) {
        let finalUsers = dbUsers.map((u) => ({ ...u, nombre: fixUserName(u.nombre) }));

        const missingDefaults = DEFAULT_USERS.filter(
          (def) => !finalUsers.some((u) => u.email.toLowerCase() === def.email.toLowerCase())
        );

        if (missingDefaults.length > 0) {
          try {
            await supabase.from('user_profiles').upsert(
              missingDefaults.map((u) => ({
                email: u.email.toLowerCase(),
                nombre: fixUserName(u.nombre),
                password_hash: u.password_hash,
                rol: u.rol,
                punto_entrega: u.punto_entrega,
                activo: u.activo,
              })),
              { onConflict: 'email' }
            );

            const { data: refreshedUsers } = await supabase
              .from('user_profiles')
              .select('*')
              .order('created_at', { ascending: false });

            if (refreshedUsers && refreshedUsers.length > 0) {
              finalUsers = refreshedUsers.map((u) => ({ ...u, nombre: fixUserName(u.nombre) }));
            }
          } catch {}
        }

        setUsers(finalUsers);
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(finalUsers));
      }
    } catch {}
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const emailClean = email.toLowerCase().trim();

    if (!nombre || !emailClean || !password) {
      setMessage({ type: 'error', text: 'Por favor complete todos los campos requeridos.' });
      setSubmitting(false);
      return;
    }

    const newUserPayload = {
      email: emailClean,
      nombre: nombre.trim(),
      password_hash: password,
      rol: rol,
      punto_entrega: puntoEntrega,
      activo: true,
    };

    let savedToRemote = false;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .insert([newUserPayload]);

      if (error) {
        if (error.code === '23505') {
          setMessage({ type: 'error', text: `El usuario "${emailClean}" ya fue registrado previamente.` });
          setSubmitting(false);
          return;
        }
      } else {
        savedToRemote = true;
      }
    } catch {}

    const createdUser: UserProfile = {
      id: crypto.randomUUID(),
      ...newUserPayload,
      created_at: new Date().toISOString(),
    };

    const updatedUsers = [createdUser, ...users.filter((u) => u.email !== createdUser.email)];
    setUsers(updatedUsers);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedUsers));

    logUserAction(
      null,
      'USUARIO_CREADO',
      'Usuarios',
      `Alta de nuevo usuario ${emailClean} (${nombre}) - Rol: ${rol} - Punto: ${puntoEntrega}`
    );

    if (!savedToRemote) {
      try {
        const pendingSyncsRaw = localStorage.getItem('telepase_pending_user_syncs');
        let pendingSyncs: UserProfile[] = pendingSyncsRaw ? JSON.parse(pendingSyncsRaw) : [];
        pendingSyncs.push(createdUser);
        localStorage.setItem('telepase_pending_user_syncs', JSON.stringify(pendingSyncs));
      } catch {}
    }

    setMessage({
      type: 'success',
      text: savedToRemote
        ? `¡Usuario "${nombre}" (${rol}) asignado a "${puntoEntrega}" registrado exitosamente en Supabase!`
        : `¡Usuario "${nombre}" (${rol}) dado de alta exitosamente! (Registrado localmente por micro-corte de red; se respaldará en Supabase al reconectar)`,
    });

    setNombre('');
    setEmail('');
    setPassword('');
    setRol('Operador');
    setPuntoEntrega(deliveryPoints[0] || 'Santa Ana');
    setSubmitting(false);
  };

  const startEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditNombre(user.nombre);
    setEditEmail(user.email);
    setEditPassword(user.password_hash || '');
    setEditRol(user.rol);
    setEditPuntoEntrega(user.punto_entrega || deliveryPoints[0] || 'Santa Ana');
  };

  const cancelEditUser = () => {
    setEditingUser(null);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);
    setMessage(null);

    const emailClean = editEmail.toLowerCase().trim();

    const updatedUserData: UserProfile = {
      ...editingUser,
      nombre: editNombre.trim(),
      email: emailClean,
      password_hash: editPassword,
      rol: editRol,
      punto_entrega: editPuntoEntrega,
      updated_at: new Date().toISOString(),
    };

    let savedToRemote = false;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          nombre: updatedUserData.nombre,
          email: updatedUserData.email,
          password_hash: updatedUserData.password_hash,
          rol: updatedUserData.rol,
          punto_entrega: updatedUserData.punto_entrega,
          updated_at: updatedUserData.updated_at,
        })
        .eq('email', editingUser.email);

      if (!error) {
        savedToRemote = true;
      }
    } catch {}

    const updatedUsers = users.map((u) =>
      u.email === editingUser.email || u.id === editingUser.id ? updatedUserData : u
    );

    setUsers(updatedUsers);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedUsers));

    logUserAction(
      null,
      'USUARIO_EDITADO',
      'Usuarios',
      `Edición de perfil de usuario ${emailClean} (${editNombre}) - Rol: ${editRol} - Punto: ${editPuntoEntrega}`
    );

    if (!savedToRemote) {
      try {
        const pendingSyncsRaw = localStorage.getItem('telepase_pending_user_syncs');
        let pendingSyncs: UserProfile[] = pendingSyncsRaw ? JSON.parse(pendingSyncsRaw) : [];
        pendingSyncs.push(updatedUserData);
        localStorage.setItem('telepase_pending_user_syncs', JSON.stringify(pendingSyncs));
      } catch {}
    }

    const currentSessionRaw = localStorage.getItem('telepase_user_session');
    if (currentSessionRaw) {
      try {
        const session = JSON.parse(currentSessionRaw);
        if (session.email.toLowerCase() === editingUser.email.toLowerCase()) {
          const updatedSession = {
            ...session,
            nombre: updatedUserData.nombre,
            email: updatedUserData.email,
            rol: updatedUserData.rol,
            punto_entrega: updatedUserData.punto_entrega,
            activo: updatedUserData.activo,
          };
          localStorage.setItem('telepase_user_session', JSON.stringify(updatedSession));
          window.dispatchEvent(new Event('user_session_updated'));
        }
      } catch {}
    }

    setMessage({
      type: 'success',
      text: savedToRemote
        ? `¡Usuario "${updatedUserData.nombre}" actualizado correctamente en Supabase!`
        : `¡Usuario "${updatedUserData.nombre}" actualizado correctamente! (Sincronizado localmente por micro-corte de red)`,
    });

    setEditingUser(null);
    setSubmitting(false);
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

  const toggleUserStatus = (user: UserProfile) => {
    const nuevoEstado = !user.activo;
    const accionText = nuevoEstado ? 'activar' : 'desactivar';

    setConfirmModalState({
      isOpen: true,
      title: `${nuevoEstado ? 'Activar' : 'Desactivar'} Usuario`,
      message: `¿Está seguro que desea ${accionText} el usuario de "${user.nombre}" (${user.email})?`,
      confirmText: nuevoEstado ? 'Sí, Activar Usuario' : 'Sí, Desactivar Usuario',
      type: nuevoEstado ? 'primary' : 'warning',
      icon: nuevoEstado ? 'confirm' : 'warning',
      onConfirm: async () => {
        try {
          await supabase
            .from('user_profiles')
            .update({ activo: nuevoEstado, updated_at: new Date().toISOString() })
            .eq('email', user.email);
        } catch {}

        const updatedUsers = users.map((u) =>
          u.email === user.email ? { ...u, activo: nuevoEstado } : u
        );

        setUsers(updatedUsers);
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedUsers));
      },
    });
  };

  return (
    <div className="space-y-6">

      {/* FORMULARIO DE EDICIÓN */}
      {editingUser && (
        <div className="bg-amber-50 rounded-2xl shadow-md border-2 border-amber-400 overflow-hidden">
          <div className="bg-amber-800 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Edit className="w-5 h-5 text-amber-200" />
              <h3 className="font-bold text-base">Modificar Datos de Usuario</h3>
            </div>
            <button
              onClick={cancelEditUser}
              className="p-1 hover:bg-amber-700 rounded-lg text-amber-200 hover:text-white transition"
              title="Cancelar edición"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleUpdateUser} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Nombre y Apellido *</label>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-amber-300 text-xs focus:ring-2 focus:ring-amber-700 focus:outline-none bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Email / Usuario *</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-amber-300 text-xs focus:ring-2 focus:ring-amber-700 focus:outline-none bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Contraseña *</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-amber-300 text-xs font-mono focus:ring-2 focus:ring-amber-700 focus:outline-none bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Rol de Acceso *</label>
                <select
                  value={editRol}
                  onChange={(e) => setEditRol(e.target.value as 'Administrador' | 'Operador' | 'Consulta')}
                  className="w-full p-2.5 rounded-xl border border-amber-300 text-xs font-bold focus:ring-2 focus:ring-amber-700 focus:outline-none bg-white text-slate-800"
                >
                  <option value="Operador">Operador (Registra Entregas)</option>
                  <option value="Administrador">Administrador (Control Total)</option>
                  <option value="Consulta">Consulta (Solo Lectura Inventarios)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 uppercase mb-1">Punto de Entrega *</label>
                <select
                  value={editPuntoEntrega}
                  onChange={(e) => setEditPuntoEntrega(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-amber-300 text-xs font-bold focus:ring-2 focus:ring-amber-700 focus:outline-none bg-white text-slate-800"
                >
                  <option value="Todos">Todos (Acceso Global)</option>
                  {deliveryPoints.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 uppercase tracking-wider"
              >
                <Save className="w-4 h-4" />
                <span>{submitting ? 'Guardando Cambios...' : 'GUARDAR CAMBIOS EN USUARIO'}</span>
              </button>

              <button
                type="button"
                onClick={cancelEditUser}
                className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition uppercase"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sección Alta de Usuario */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="bg-cs-dark text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-cs-accent" />
            <h3 className="font-bold text-base">Dar de Alta Nuevo Usuario</h3>
          </div>
          <span className="text-[11px] font-bold bg-white/10 text-emerald-200 px-3 py-1 rounded-full border border-white/15">
            Configuración & Asignación
          </span>
        </div>

        <form onSubmit={handleCreateUser} className="p-5 space-y-4">
          {message && (
            <div
              className={`p-3 rounded-xl flex items-center space-x-2 text-xs font-medium ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">Nombre y Apellido *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ej. Camilo Korzyniewski"
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">Email / Usuario *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="camilo.k@ceeenriquez.com"
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">Contraseña Inicial *</label>
              <div className="relative">
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="ej. Clave123*"
                  className="w-full p-2.5 pr-8 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-cs-primary focus:outline-none"
                  required
                />
                <Key className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">Rol de Acceso *</label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as 'Administrador' | 'Operador' | 'Consulta')}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-slate-50 text-slate-800"
              >
                <option value="Operador">Operador (Registra Entregas)</option>
                <option value="Administrador">Administrador (Control Total)</option>
                <option value="Consulta">Consulta (Solo Lectura Inventarios)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-cs-primary uppercase mb-1">Punto de Entrega Asignado *</label>
              <select
                value={puntoEntrega}
                onChange={(e) => setPuntoEntrega(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none bg-slate-50 text-slate-800"
              >
                <option value="Todos">Todos (Acceso Global)</option>
                {deliveryPoints.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-cs-primary hover:bg-cs-dark text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 uppercase tracking-wider"
          >
            <UserPlus className="w-4 h-4" />
            <span>{submitting ? 'Guardando Usuario...' : 'DAR DE ALTA USUARIO'}</span>
          </button>
        </form>
      </div>

      {/* Listado y Gestión de Estado de Usuarios */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-cs-primary" />
            <h3 className="font-bold text-base text-slate-900">Usuarios Registrados en el Sistema</h3>
          </div>
          <button
            onClick={fetchUsers}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title="Recargar usuarios"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cs-primary' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-cs-dark text-white">
              <tr>
                <th className="p-3">Nombre y Apellido</th>
                <th className="p-3">Email / Usuario</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Punto de Entrega Asignado</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.id || u.email} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-semibold text-slate-900">{u.nombre}</td>
                  <td className="p-3 font-mono text-slate-600">{u.email}</td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        u.rol === 'Administrador'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : u.rol === 'Consulta'
                          ? 'bg-sky-100 text-sky-800 border border-sky-300'
                          : 'bg-teal-100 text-teal-800 border border-teal-300'
                      }`}
                    >
                      {u.rol}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-slate-800">
                    <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
                      <MapPin className="w-3 h-3 text-cs-primary" />
                      <span>{u.punto_entrega || 'Santa Ana'}</span>
                    </span>
                  </td>
                  <td className="p-3">
                    {u.activo ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>ACTIVO</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                        <UserX className="w-3.5 h-3.5" />
                        <span>DESACTIVADO</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => startEditUser(u)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                        title="Modificar nombre, email, clave, rol o punto de entrega"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => toggleUserStatus(u)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
                          u.activo
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {u.activo ? (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>Desactivar</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Activar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
