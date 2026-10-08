import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 text-center max-w-md w-full space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Página no encontrada</h2>
        <p className="text-xs text-slate-600">
          La dirección que buscas no existe o ha sido movida.
        </p>
        <Link
          href="/"
          className="inline-block w-full py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition"
        >
          Volver al Inicio
        </Link>
      </div>
    </div>
  );
}
