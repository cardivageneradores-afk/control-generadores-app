'use client';

import { FormEvent, useEffect, useState } from 'react';

type SetupState = 'loading' | 'available' | 'unavailable' | 'complete' | 'error';

export default function SetupPage() {
  const [state, setState] = useState<SetupState>('loading');
  const [form, setForm] = useState({ token: '', email: '', nombre: '', password: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/setup', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        setState(response.ok && data.available ? 'available' : 'unavailable');
      })
      .catch(() => setState('error'));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const response = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? 'No se pudo completar el alta.');
      return;
    }
    setState('complete');
    setMessage('Administrador creado. Retira ADMIN_SETUP_TOKEN de Vercel antes de continuar.');
    setForm({ token: '', email: '', nombre: '', password: '' });
  }

  if (state === 'loading') return <main className="login-shell"><div className="login-box">Comprobando disponibilidad...</div></main>;
  if (state === 'unavailable') return <main className="login-shell"><div className="login-box"><h1>Alta no disponible</h1><p>El alta inicial ya se completó o no está habilitada.</p></div></main>;
  if (state === 'error') return <main className="login-shell"><div className="login-box"><h1>No se pudo comprobar el alta</h1><p>Revisa la configuración de Supabase y vuelve a intentarlo.</p></div></main>;
  if (state === 'complete') return <main className="login-shell"><div className="login-box"><h1>Alta completada</h1><p>{message}</p></div></main>;

  return (
    <main className="login-shell">
      <form className="login-box" onSubmit={submit}>
        <h1>Crear administrador inicial</h1>
        <p>Solo se permite antes de crear cualquier usuario.</p>
        <input required placeholder="Token de configuración" type="password" value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })} />
        <input required placeholder="Nombre" maxLength={120} value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
        <input required placeholder="Email" type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input required placeholder="Contraseña (mínimo 12 caracteres)" type="password" minLength={12} maxLength={256} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        {message ? <div className="login-error show">{message}</div> : null}
        <button type="submit">Crear administrador</button>
      </form>
    </main>
  );
}
