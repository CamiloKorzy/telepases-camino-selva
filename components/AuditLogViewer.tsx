'use client';

import React, { useState, useEffect } from 'react';
import { AuditLog, UserSession } from '@/types/database';
import { getAuditLogs, exportAuditLogsToExcel } from '@/lib/auditLogger';
import { ShieldAlert, Search, RefreshCw, Download, Filter, User, Layers, Calendar, Clock, MapPin, CheckCircle, Info } from 'lucide-react';

interface AuditLogViewerProps {
  currentUser: UserSession;
}

export default function AuditLogViewer({ currentUser }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('Todos');
  const [selectedRole, setSelectedRole] = useState<string>('Todos');
  const [loading, setLoading] = useState(true);

  const fetchLogs = () => {
    setLoading(true);
    const data = getAuditLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filtrado de logs
  const filteredLogs = logs.filter((l) => {
    if (!l) return false;

    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      l.usuario_email?.toLowerCase().includes(term) ||
      l.usuario_nombre?.toLowerCase().includes(term) ||
      l.accion?.toLowerCase().includes(term) ||
      l.detalle?.toLowerCase().includes(term) ||
      l.punto_entrega?.toLowerCase().includes(term);

    const matchesModule = selectedModule === 'Todos' || l.modulo === selectedModule;
    const matchesRole = selectedRole === 'Todos' || l.usuario_rol === selectedRole;

    return matchesSearch && matchesModule && matchesRole;
  });

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl border border-rose-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Logs de Auditoría & Registro de Operaciones</h2>
            <p className="text-xs text-slate-500">
              Registro inalterable de cada acción realizada en la plataforma (Administradores, Operadores y Consulta)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchLogs}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center space-x-1 text-xs font-bold"
            title="Recargar Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={() => exportAuditLogsToExcel(filteredLogs)}
            className="px-3 py-2 bg-cs-primary hover:bg-emerald-950 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
            title="Exportar logs a Excel"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Bar de Filtros */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        {/* Selector de Módulo */}
        <div className="flex items-center space-x-2 text-xs">
          <Filter className="w-4 h-4 text-cs-primary flex-shrink-0" />
          <span className="font-bold text-slate-700">Módulo:</span>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="p-2 bg-white border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
          >
            <option value="Todos">Todos los Módulos</option>
            <option value="Autenticación">Autenticación</option>
            <option value="Entregas">Entregas</option>
            <option value="Movimientos">Movimientos</option>
            <option value="Alta de TAGs">Alta de TAGs</option>
            <option value="Usuarios">Usuarios</option>
            <option value="Puntos de Entrega">Puntos de Entrega</option>
            <option value="Series & Auditoría">Series & Auditoría</option>
          </select>
        </div>

        {/* Selector de Rol */}
        <div className="flex items-center space-x-2 text-xs">
          <User className="w-4 h-4 text-cs-primary flex-shrink-0" />
          <span className="font-bold text-slate-700">Rol:</span>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="p-2 bg-white border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-cs-primary focus:outline-none"
          >
            <option value="Todos">Todos los Roles</option>
            <option value="Administrador">Administrador</option>
            <option value="Operador">Operador</option>
            <option value="Consulta">Consulta</option>
          </select>
        </div>

        {/* Buscador de Texto Libre */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por usuario, acción o detalle..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cs-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Listado de Logs */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs text-left text-slate-700">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">Fecha y Hora</th>
              <th className="p-3">Usuario / Email</th>
              <th className="p-3 text-center">Rol</th>
              <th className="p-3">Punto Entrega</th>
              <th className="p-3 text-center">Módulo</th>
              <th className="p-3">Acción</th>
              <th className="p-3">Detalle de Operación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No se registraron operaciones de auditoría para los criterios seleccionados.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                    {log.created_at ? new Date(log.created_at).toLocaleString('es-AR') : '-'}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{log.usuario_nombre}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{log.usuario_email}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        log.usuario_rol === 'Administrador'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : log.usuario_rol === 'Consulta'
                          ? 'bg-sky-100 text-sky-900 border border-sky-300'
                          : 'bg-teal-100 text-teal-900 border border-teal-300'
                      }`}
                    >
                      {log.usuario_rol}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{log.punto_entrega || 'Todos'}</td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px] text-slate-700 border">
                      {log.modulo}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-slate-800 uppercase tracking-tight">{log.accion}</td>
                  <td className="p-3 text-slate-600 max-w-xs truncate" title={log.detalle}>
                    {log.detalle}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
