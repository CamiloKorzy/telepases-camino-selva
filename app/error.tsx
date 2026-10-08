'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 text-center max-w-md w-full space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Ocurrió un error inesperado</h2>
        <p className="text-xs text-slate-600 font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
          {error.message || 'Error en la aplicación.'}
        </p>
        <button
          onClick={() => reset()}
          className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
