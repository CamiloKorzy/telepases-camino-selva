'use client';

import { useEffect, useState } from 'react';

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

export default function SyncBridgePage() {
  const [status, setStatus] = useState('Iniciando puente de sincronización...');

  useEffect(() => {
    try {
      const payload: Record<string, any> = {};
      let keyCount = 0;

      STORAGE_KEYS.forEach((key) => {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            payload[key] = JSON.parse(val);
          } catch {
            payload[key] = val;
          }
          keyCount++;
        }
      });

      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'TELEPASE_BRIDGE_PAYLOAD', payload, keyCount }, '*');
        setStatus(`Sincronización enviada (${keyCount} registros encontrados).`);
      } else {
        setStatus(`Puente listo (${keyCount} registros locales).`);
      }
    } catch (err: any) {
      setStatus('Error al leer datos locales: ' + err.message);
    }
  }, []);

  return (
    <div style={{ padding: '10px', fontFamily: 'sans-serif', fontSize: '12px', color: '#333' }}>
      <p>{status}</p>
    </div>
  );
}
