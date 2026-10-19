'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function keyToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo completar la operación.');
  }
}

export default function PushToggle({ onMessage }: { onMessage: (message: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const ok = Boolean(PUBLIC_KEY) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const timer = window.setTimeout(async () => {
      setSupported(ok);
      if (!ok) return;
      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        const existing = await registration?.pushManager.getSubscription();
        setActive(Boolean(existing) && Notification.permission === 'granted');
      } catch {
        setActive(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!PUBLIC_KEY) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permiso de notificaciones denegado. Actívalo en los ajustes del navegador.');
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToUint8Array(PUBLIC_KEY) }));
      await post('/api/push/suscribir', { subscription: subscription.toJSON() });
      setActive(true);
      onMessage('Notificaciones activadas en este dispositivo.');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await post('/api/push/desuscribir', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setActive(false);
      onMessage('Notificaciones desactivadas en este dispositivo.');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'No se pudieron desactivar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {supported ? (
        <button className="button ghost compact-action" disabled={busy} onClick={active ? disable : enable} title="Avisos cuando se entrega o recoge un generador">
          {active ? <BellOff size={13} /> : <Bell size={13} />} {active ? 'Desactivar notificaciones' : 'Activar notificaciones'}
        </button>
      ) : (
        <button className="button ghost compact-action" onClick={() => setShowHelp((value) => !value)}>
          <Bell size={13} /> Notificaciones
        </button>
      )}
      {!supported && showHelp ? (
        <small className="push-help" role="note">
          En iPhone (iOS 16.4 o superior): abre la web en Safari, pulsa Compartir → «Añadir a pantalla de inicio», abre la app desde el icono y pulsa «Activar notificaciones» aceptando el permiso.
        </small>
      ) : null}
    </>
  );
}
