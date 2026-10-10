'use client';

import React, { useState } from 'react';
import { Download, Upload, Database, CheckCircle2, AlertCircle, X, FileText, Copy, Check } from 'lucide-react';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => void;
}

const STORAGE_KEYS = [
  'telepase_user_session',
  'telepase_registered_user_profiles',
  'telepase_local_tag_deliveries',
  'telepase_local_tag_batches',
  'telepase_local_tag_transfers',
  'telepase_master_delivery_points_v4',
  'telepase_local_delivery_points_v3',
  'telepase_local_delivery_points',
  'telepase_activation_doc_config',
];

export default function BackupRestoreModal({ isOpen, onClose, onDataRestored }: BackupRestoreModalProps) {
  const [jsonText, setJsonText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Exportar todo el almacenamiento local a un objeto JSON
  const handleExport = () => {
    const backupData: Record<string, any> = {};
    STORAGE_KEYS.forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) {
        try {
          backupData[key] = JSON.parse(val);
        } catch {
          backupData[key] = val;
        }
      }
    });

    const jsonString = JSON.stringify(backupData, null, 2);
    setJsonText(jsonString);

    // Descargar como archivo .json
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_telepases_caminoselva_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setMessage({ type: 'success', text: '¡Copia de seguridad exportada y descargada correctamente!' });
  };

  // Copiar JSON al portapapeles
  const handleCopyClipboard = () => {
    const backupData: Record<string, any> = {};
    STORAGE_KEYS.forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) {
        try {
          backupData[key] = JSON.parse(val);
        } catch {
          backupData[key] = val;
        }
      }
    });
    const jsonString = JSON.stringify(backupData);
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setMessage({ type: 'success', text: '¡Datos copiados al portapapeles! Puedes pegarlos en el nuevo dominio.' });
  };

  // Importar desde archivo .json seleccionado por el usuario
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        restoreBackupJSON(content);
      } catch (err: any) {
        setMessage({ type: 'error', text: 'El archivo seleccionado no es un JSON válido de respaldo.' });
      }
    };
    reader.readAsText(file);
  };

  // Restaurar respaldo desde string JSON
  const restoreBackupJSON = (rawJSON: string) => {
    try {
      const parsed = JSON.parse(rawJSON);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Formato inválido');
      }

      let restoredCount = 0;
      Object.keys(parsed).forEach((key) => {
        if (key.startsWith('telepase_')) {
          const val = typeof parsed[key] === 'string' ? parsed[key] : JSON.stringify(parsed[key]);
          localStorage.setItem(key, val);
          restoredCount++;
        }
      });

      if (restoredCount === 0) {
        throw new Error('No se encontraron claves de datos de TelePASE en el respaldo.');
      }

      // Notificar eventos de actualización
      window.dispatchEvent(new Event('delivery_points_updated'));
      window.dispatchEvent(new Event('tag_batches_updated'));
      window.dispatchEvent(new Event('tag_transfers_updated'));
      window.dispatchEvent(new Event('user_session_updated'));

      setMessage({ type: 'success', text: `¡Éxito! Se restauraron ${restoredCount} bloques de datos de inventario y entregas.` });
      setTimeout(() => {
        onDataRestored();
        onClose();
      }, 1500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al procesar el JSON de respaldo.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Migración & Copia de Seguridad de Datos</h2>
            <p className="text-xs text-slate-500">
              Respaldar o migrar entregas, lotes y usuarios entre diferentes dominios o navegadores
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-semibold flex items-center space-x-2 ${
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

        <div className="space-y-6 text-xs text-slate-700">
          {/* EXPLICACIÓN DE CAMBIO DE DOMINIO */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
            <h4 className="font-bold text-amber-900 flex items-center space-x-1.5">
              <span>⚠️ ¿Por qué parecen faltar datos al cambiar de dominio?</span>
            </h4>
            <p className="text-amber-800 leading-relaxed text-[11px]">
              Los navegadores por seguridad separan los datos (LocalStorage) por cada dominio web (ej. <code>vercel.app</code> vs <code>telepase.caminoselva.com</code>). 
              <b> Tus datos NO se borraron ni se perdieron</b>; siguen guardados intactos en la dirección anterior.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-amber-900 text-[11px] pt-1 font-medium">
              <li>Abre el dominio anterior en este mismo navegador.</li>
              <li>Haz clic en <b>"Exportar / Copiar Datos"</b> abajo.</li>
              <li>Abre <b>telepase.caminoselva.com</b> y haz clic en <b>"Importar Copia de Seguridad"</b>.</li>
            </ol>
          </div>

          {/* OPCIÓN A: EXPORTAR */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Download className="w-4 h-4 text-cs-primary" />
              <span>1. Respaldar / Exportar Datos Actuales</span>
            </h3>
            <p className="text-slate-500">
              Genera una copia de seguridad descargable (.json) con todos tus registros de entregas, lotes y usuarios.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-cs-primary hover:bg-emerald-800 text-white rounded-xl font-bold shadow-sm transition flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Archivo JSON de Respaldo</span>
              </button>

              <button
                onClick={handleCopyClipboard}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold transition flex items-center space-x-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span>{copied ? '¡Copiado!' : 'Copiar Texto JSON'}</span>
              </button>
            </div>
          </div>

          {/* OPCIÓN B: IMPORTAR */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Upload className="w-4 h-4 text-cs-primary" />
              <span>2. Restaurar / Importar Copia de Seguridad</span>
            </h3>
            <p className="text-slate-500">
              Carga tu archivo de respaldo .json o pega el texto guardado para restaurar inmediatamente todas tus entregas e inventarios.
            </p>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">Subir Archivo .json:</label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cs-primary file:text-white hover:file:bg-emerald-800 cursor-pointer"
              />
            </div>

            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">O Pegar Código JSON Directamente:</label>
              <textarea
                rows={3}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='Pega aquí el contenido JSON de respaldo...'
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-[11px] bg-white focus:ring-2 focus:ring-cs-primary focus:outline-none"
              />
              <button
                onClick={() => restoreBackupJSON(jsonText)}
                disabled={!jsonText.trim()}
                className="mt-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold shadow-sm transition flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Restaurar Datos desde Código Pegado</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
