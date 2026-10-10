'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserSession } from '@/types/database';
import { fixUserName } from '@/lib/deliveryPoints';
import { Lock, Mail, LogIn, AlertCircle, ShieldCheck } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (session: UserSession) => void;
}

const DEFAULT_ACCOUNTS: UserProfile[] = [
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
    email: 'operador@caminoselva.com',
    nombre: 'Operador Santa Ana',
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
    email: 'operador.coloniavictoria@caminoselva.com',
    nombre: 'Peaje Colonia Victoria',
    password_hash: 'op123456',
    rol: 'Operador',
    punto_entrega: 'Colonia Victoria',
    activo: true,
  },
  {
    id: '7',
    email: 'operador.parajefachinal@caminoselva.com',
    nombre: 'Peaje Paraje Fachinal',
    password_hash: 'op123456',
    rol: 'Operador',
    punto_entrega: 'Paraje Fachinal',
    activo: true,
  },
  {
    id: '8',
    email: 'operador.ituzaingo@caminoselva.com',
    nombre: 'Peaje Ituzaingó',
    password_hash: 'op123456',
    rol: 'Operador',
    punto_entrega: 'Ituzaingó',
    activo: true,
  },
];

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const emailClean = email.toLowerCase().trim();

    if (!emailClean || !password) {
      setError('Por favor ingrese su usuario/email y contraseña.');
      setLoading(false);
      return;
    }

    try {
      let registeredUsers: UserProfile[] = [];

      // 1. Obtener usuarios guardados en localStorage
      const localStored = localStorage.getItem('telepase_registered_user_profiles');
      if (localStored) {
        try {
          registeredUsers = JSON.parse(localStored);
        } catch {}
      }

      // 2. Obtener usuarios de Supabase si la base de datos está disponible
      try {
        const { data: dbUsers } = await supabase.from('user_profiles').select('*');
        if (dbUsers && dbUsers.length > 0) {
          const userMap = new Map<string, UserProfile>();
          [...dbUsers, ...registeredUsers].forEach((u) => userMap.set(u.email.toLowerCase(), u));
          registeredUsers = Array.from(userMap.values());
        }
      } catch {}

      // 3. Incluir cuentas por defecto si no existen aún en la lista
      DEFAULT_ACCOUNTS.forEach((def) => {
        if (!registeredUsers.some((u) => u.email.toLowerCase() === def.email.toLowerCase())) {
          registeredUsers.push(def);
        }
      });

      // 4. Buscar usuario coincidente por correo o nombre de usuario
      const foundUser = registeredUsers.find((u) => {
        const mailLower = u.email.toLowerCase();
        const usernameLower = mailLower.split('@')[0];
        return mailLower === emailClean || usernameLower === emailClean;
      });

      if (!foundUser) {
        throw new Error('Usuario no registrado. Verifique su usuario o solicite su alta al Administrador.');
      }

      if (foundUser.activo === false) {
        throw new Error('Su usuario ha sido DESACTIVADO por el Administrador.');
      }

      // 5. Verificar contraseña exacta
      const expectedPass = foundUser.password_hash || 'admin123';
      if (password !== expectedPass) {
        throw new Error('Contraseña incorrecta. Verifique la clave e intente nuevamente.');
      }

      // 6. Generar y guardar la sesión de usuario activa
      const session: UserSession = {
        email: foundUser.email,
        nombre: fixUserName(foundUser.nombre),
        rol: foundUser.rol || 'Operador',
        punto_entrega: foundUser.punto_entrega || 'Todos',
        activo: true,
      };

      localStorage.setItem('telepase_user_session', JSON.stringify(session));
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cs-bg flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header con Logo Oficial Camino Selva */}
        <div className="bg-cs-dark p-6 text-center space-y-3">
          <div className="flex justify-center">
            <img
              src="/logo.svg"
              alt="Camino Selva S.A."
              className="h-12 w-auto object-contain brightness-0 invert"
            />
          </div>
          <div className="text-emerald-100 text-xs font-semibold tracking-wider uppercase">
            Acceso a la Plataforma TelePASE
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
              Usuario / Email
            </label>
            <div className="relative">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="camilo.k@ceeenriquez.com"
                className="w-full p-3 pl-10 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-cs-primary focus:outline-none"
                required
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-cs-primary uppercase mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3 pl-10 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-cs-primary focus:outline-none"
                required
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-cs-primary hover:bg-cs-dark text-white font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Verificando...' : 'INICIAR SESIÓN'}</span>
          </button>

          <div className="pt-2 text-center text-[11px] text-slate-500 flex items-center justify-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cs-primary" />
            <span>Sistema Seguro Corredor Vial Noreste</span>
          </div>
        </form>
      </div>
    </div>
  );
}
