'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, X, Truck, Trash2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'primary' | 'danger' | 'warning';
  icon?: 'confirm' | 'danger' | 'warning' | 'truck' | 'trash';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = 'Confirmación de Operación',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'primary',
  icon = 'confirm',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const renderIcon = () => {
    switch (icon) {
      case 'danger':
      case 'trash':
        return <Trash2 className="w-5 h-5 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'truck':
        return <Truck className="w-5 h-5 text-cs-accent" />;
      case 'confirm':
      default:
        return <CheckCircle2 className="w-5 h-5 text-cs-accent" />;
    }
  };

  const getButtonStyle = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-700 hover:bg-rose-800 text-white';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white';
      case 'primary':
      default:
        return 'bg-cs-primary hover:bg-cs-dark text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150">
        {/* Encabezado Institucional Camino Selva S.A. */}
        <div className="bg-cs-dark text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {renderIcon()}
            <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo del Mensaje */}
        <div className="p-6 text-slate-800 text-xs sm:text-sm font-medium leading-relaxed">
          {message}
        </div>

        {/* Acciones */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition uppercase tracking-wider"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-md transition uppercase tracking-wider flex items-center space-x-1.5 ${getButtonStyle()}`}
          >
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
