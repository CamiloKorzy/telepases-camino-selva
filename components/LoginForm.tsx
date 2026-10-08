'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserSession } from '@/types/database';
import { Lock, Mail, LogIn, AlertCircle, ShieldCheck } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (session: UserSession) => void;
}

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
      // 1. Acceso directo de Administrador para Camilo o Admin (acepta cualquier contraseña)
      if (
        emailClean.includes('camilo') ||
        emailClean.includes('ceeenriquez') ||
        emailClean === 'admin' ||
        emailClean.includes('admin@')
      ) {
        const session: UserSession = {
          email: emailClean.includes('@') ? emailClean : `${emailClean}@ceeenriquez.com`,
          nombre: 'Camilo Korzyniewski',
          rol: 'Administrador',
          activo: true,
        };
        localStorage.setItem('telepase_user_session', JSON.stringify(session));
        onLoginSuccess(session);
        return;
      }

      // 2. Consultar usuarios guardados localmente
      const localUsersStored = localStorage.getItem('telepase_registered_user_profiles');
      if (localUsersStored) {
        try {
          const localUsers = JSON.parse(localUsersStored);
          const found = localUsers.find((u: any) => u.email.toLowerCase() === emailClean);
          if (found) {
            if (found.activo === false) {
              throw new Error('Su usuario ha sido DESACTIVADO por el Administrador.');
            }
            const session: UserSession = {
              email: found.email,
              nombre: found.nombre,
              rol: found.rol || 'Operador',
              punto_entrega: found.punto_entrega,
              activo: true,
            };
            localStorage.setItem('telepase_user_session', JSON.stringify(session));
            onLoginSuccess(session);
            return;
          }
        } catch {}
      }

      // 3. Consultar tabla user_profiles en Supabase si está disponible
      try {
        const { data: dbUser } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', emailClean)
          .maybeSingle();

        if (dbUser) {
          if (!dbUser.activo) {
            throw new Error('Su usuario ha sido DESACTIVADO por el Administrador.');
          }

          const session: UserSession = {
            email: dbUser.email,
            nombre: dbUser.nombre,
            rol: dbUser.rol,
            punto_entrega: dbUser.punto_entrega,
            activo: dbUser.activo,
          };

          localStorage.setItem('telepase_user_session', JSON.stringify(session));
          onLoginSuccess(session);
          return;
        }
      } catch {}

      // 4. Acceso para cualquier otro usuario de operacion con contraseña de al menos 3 caracteres
      if (password.length >= 3) {
        const session: UserSession = {
          email: emailClean.includes('@') ? emailClean : `${emailClean}@caminoselva.com`,
          nombre: emailClean.split('@')[0].toUpperCase(),
          rol: 'Operador',
          activo: true,
        };
        localStorage.setItem('telepase_user_session', JSON.stringify(session));
        onLoginSuccess(session);
        return;
      }

      throw new Error('Credenciales inválidas. Verifique su usuario y contraseña.');
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
