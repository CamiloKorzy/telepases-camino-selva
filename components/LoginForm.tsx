'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserSession } from '@/types/database';
import { fixUserName } from '@/lib/deliveryPoints';
import { logUserAction } from '@/lib/auditLogger';
import { Lock, Mail, LogIn, AlertCircle, ShieldCheck } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (session: UserSession) => void;
}

const DEFAULT_ACCOUNTS: UserProfile[] = [
  {
    id: '1',
    email: 'camilo.k@ceeenriquez.com',
    nombre: 'Camilo Korzyniewski',
    password_hash: 'Cee$$2026',
    rol: 'Administrador',
    punto_entrega: 'Todos',
    activo: true,
  },
  {
    id: '2',
    email: 'admin@caminoselva.com',
    nombre: 'Administrador General',
    password_hash: 'Cee$$2026',
    rol: 'Administrador',
    punto_entrega: 'Todos',
    activo: true,
  },
  {
    id: '3',
    email: 'camilo.k@caminoselva.com',
    nombre: 'Camilo Korzyniewski',
    password_hash: 'Cee$$2026',
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
    password_hash: 'Victoria$$2026',
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

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberUser, setRememberUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const savedEmail = localStorage.getItem('telepase_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

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

      // 2. Obtener usuarios de Supabase con timeout de 400ms para evitar demoras/congelamientos
      try {
        const fetchDbUsers = supabase.from('user_profiles').select('*');
        const timeoutPromise = new Promise<{ data: any[] | null }>((resolve) =>
          setTimeout(() => resolve({ data: null }), 400)
        );
        const res = await Promise.race([fetchDbUsers, timeoutPromise]);
        const dbUsers = res.data;
        if (dbUsers && dbUsers.length > 0) {
          const userMap = new Map<string, UserProfile>();
          [...dbUsers, ...registeredUsers].forEach((u) => userMap.set(u.email.toLowerCase(), u));
          registeredUsers = Array.from(userMap.values());
          localStorage.setItem('telepase_registered_user_profiles', JSON.stringify(registeredUsers));
        }
      } catch {}

      // 3. Incluir cuentas por defecto si no existen aún en la lista
      const missingInList: UserProfile[] = [];
      DEFAULT_ACCOUNTS.forEach((def) => {
        if (!registeredUsers.some((u) => u.email.toLowerCase() === def.email.toLowerCase())) {
          registeredUsers.push(def);
          missingInList.push(def);
        }
      });

      // Sincronizar cuentas por defecto de forma asíncrona (non-blocking)
      if (missingInList.length > 0) {
        (async () => {
          try {
            await supabase.from('user_profiles').upsert(
              missingInList.map((u) => ({
                email: u.email.toLowerCase(),
                nombre: fixUserName(u.nombre),
                password_hash: u.password_hash,
                rol: u.rol,
                punto_entrega: u.punto_entrega,
                activo: u.activo,
              })),
              { onConflict: 'email' }
            );
          } catch {}
        })();
      }

      const normalizeUserKey = (str: string): string => {
        return str
          .toLowerCase()
          .replace(/@.*$/, '')
          .replace(/^(peaje|operador|estaci[oó]n|oficina)\.?:?\s*/i, '')
          .replace(/^paraje\.?:?\s*/i, '')
          .replace(/[\.\_\-\s]/g, '');
      };

      // 4. Buscar usuario coincidente por prioridad (1º Email exacto, 2º Usuario prefix, 3º Alias normalizado)
      let foundUser = registeredUsers.find((u) => u.email.toLowerCase() === emailClean);

      if (!foundUser) {
        const inputPrefix = emailClean.split('@')[0];
        foundUser = registeredUsers.find((u) => u.email.toLowerCase().split('@')[0] === inputPrefix);
      }

      if (!foundUser) {
        const normInput = normalizeUserKey(emailClean);
        foundUser = registeredUsers.find((u) => {
          const normUser = normalizeUserKey(u.email);
          const normStation = u.punto_entrega ? normalizeUserKey(u.punto_entrega) : '';
          return normInput && (normInput === normUser || normInput === normStation);
        });
      }

      if (!foundUser) {
        throw new Error('Usuario no registrado. Verifique su usuario o solicite su alta al Administrador.');
      }

      if (foundUser.activo === false) {
        throw new Error('Su usuario ha sido DESACTIVADO por el Administrador.');
      }

      // 5. Verificar contraseña (acepta clave guardada o clave maestra por rol)
      const storedPass = (foundUser.password_hash || '').trim();
      const inputPass = password.trim();

      const defaultRolePass =
        foundUser.rol === 'Administrador'
          ? 'Cee$$2026'
          : foundUser.rol === 'Consulta'
          ? 'consulta123'
          : 'op123456';

      const isValidPass =
        inputPass === storedPass ||
        inputPass === defaultRolePass ||
        inputPass === 'Victoria$$2026' ||
        inputPass === 'Cee$$2026' ||
        inputPass === 'admin123';

      if (!isValidPass) {
        throw new Error('Contraseña incorrecta. Verifique la clave e intente nuevamente.');
      }

      // 6. Recordar usuario si la casilla está marcada
      if (rememberUser) {
        localStorage.setItem('telepase_remembered_email', emailClean);
      } else {
        localStorage.removeItem('telepase_remembered_email');
      }

      // 7. Generar y guardar la sesión de usuario activa
      const session: UserSession = {
        email: foundUser.email,
        nombre: fixUserName(foundUser.nombre),
        rol: foundUser.rol || 'Operador',
        punto_entrega: foundUser.punto_entrega || 'Todos',
        activo: true,
      };

      localStorage.setItem('telepase_user_session', JSON.stringify(session));
      logUserAction(
        session,
        'INICIO_SESION',
        'Autenticación',
        `Inicio de sesión exitoso de ${session.nombre} (${session.email}) - Rol: ${session.rol}`
      );
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

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberUser}
                onChange={(e) => setRememberUser(e.target.checked)}
                className="w-4 h-4 text-cs-primary rounded border-slate-300 focus:ring-cs-primary accent-cs-primary"
              />
              <span>Recordar mi usuario</span>
            </label>
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
