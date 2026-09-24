"use client";

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, LogOut, Mail, Pencil, Plus, Users } from 'lucide-react';

type Role = 'editor' | 'lector';
type GeneratorStatus = 'estable' | 'en-oficina' | 'en-transito';
type MovementStatus = 'pendiente' | 'completado';
type TransportType = 'Propio' | 'Local' | 'Nacex';

interface User {
  id: string;
  email: string;
  nombre: string;
  rol: Role;
  password?: string;
}

interface Generator {
  id: string;
  codigo: string;
  modelo: string;
  ubicacion: string;
  estado: GeneratorStatus;
}

interface Movement {
  id: string;
  generador_id: string;
  fecha: string;
  origen: string;
  destino: string;
  tipo_transporte: TransportType;
  notas?: string;
  estado: MovementStatus;
  usuario?: string;
}

interface AppState {
  usuarios: User[];
  generadores: Generator[];
  movimientos: Movement[];
  ubicaciones: string[];
  destinatarios: string[];
  me: User | null;
}

const initialState: AppState = {
  usuarios: [],
  generadores: [],
  movimientos: [],
  ubicaciones: [],
  destinatarios: [],
  me: null,
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error inesperado.' }));
    throw new Error(err.error ?? 'Error inesperado.');
  }

  return res.json() as Promise<T>;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekDates() {
  const today = new Date();
  const monday = new Date(today);
  const day = (today.getDay() + 6) % 7;
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - day);

  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    return d;
  });
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function statusClass(status: GeneratorStatus) {
  if (status === 'estable') return 'pill stable';
  if (status === 'en-transito') return 'pill transit';
  return 'pill office';
}

function transportClass(type: TransportType) {
  if (type === 'Local') return 'transport-tag local';
  if (type === 'Nacex') return 'transport-tag nacex';
  return 'transport-tag own';
}

export default function Page() {
  const [state, setState] = useState<AppState>(initialState);
  const [showUsers, setShowUsers] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [editingMovId, setEditingMovId] = useState<string | null>(null);
  const [moveForm, setMoveForm] = useState({
    generadorId: '',
    fecha: isoDate(new Date()),
    origen: '',
    destino: '',
    tipoTransporte: 'Propio' as TransportType,
    notas: '',
  });
  const [generatorForm, setGeneratorForm] = useState({
    codigo: '',
    modelo: '',
    ubicacion: 'Oficina',
    estado: 'en-oficina' as GeneratorStatus,
  });
  const [userForm, setUserForm] = useState({ nombre: '', email: '', password: '', rol: 'editor' as Role });
  const [recipientEmail, setRecipientEmail] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [login, setLogin] = useState({ email: 'admin@empresa.com', password: 'admin123' });
  const [loginError, setLoginError] = useState('');

  const pendingMovements = useMemo(
    () =>
      [...state.movimientos]
        .filter((movement) => movement.estado === 'pendiente')
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [state.movimientos],
  );

  const isReadOnly = !state.me || state.me.rol !== 'editor';

  const refresh = async () => {
    try {
      const data = await api<AppState>('/api/state');
      setState({ ...initialState, ...data, me: data.me ?? null });
    } catch {
      setState((current) => ({ ...current, me: null }));
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const openMoveModal = (presetGeneratorId?: string) => {
    if (isReadOnly) {
      setToast('Estás en modo solo lectura.');
      return;
    }

    setEditingMovId(null);
    setMoveForm({
      generadorId: presetGeneratorId ?? state.generadores[0]?.id ?? '',
      fecha: isoDate(new Date()),
      origen: (state.generadores.find((g) => g.id === (presetGeneratorId ?? state.generadores[0]?.id))?.ubicacion) ?? '',
      destino: '',
      tipoTransporte: 'Propio',
      notas: '',
    });
    setShowMoveModal(true);
  };

  const openEditMovement = async (movementId: string) => {
    if (isReadOnly) return;
    const movement = state.movimientos.find((m) => m.id === movementId);
    if (!movement) return;

    setEditingMovId(movementId);
    setMoveForm({
      generadorId: movement.generador_id,
      fecha: movement.fecha,
      origen: movement.origen,
      destino: movement.destino,
      tipoTransporte: movement.tipo_transporte,
      notas: movement.notas ?? '',
    });
    setShowMoveModal(true);
  };

  const saveMovement = async () => {
    if (!moveForm.generadorId || !moveForm.fecha || !moveForm.origen || !moveForm.destino) {
      setToast('Completa generador, fecha, origen y destino.');
      return;
    }

    try {
      if (editingMovId) {
        await api(`/api/movimientos/${editingMovId}/editar`, {
          method: 'POST',
          body: JSON.stringify({
            generadorId: moveForm.generadorId,
            fecha: moveForm.fecha,
            origen: moveForm.origen,
            destino: moveForm.destino,
            tipoTransporte: moveForm.tipoTransporte,
            notas: moveForm.notas,
          }),
        });
        setToast('Movimiento actualizado.');
      } else {
        await api('/api/movimientos', {
          method: 'POST',
          body: JSON.stringify({
            generadorId: moveForm.generadorId,
            fecha: moveForm.fecha,
            origen: moveForm.origen,
            destino: moveForm.destino,
            tipoTransporte: moveForm.tipoTransporte,
            notas: moveForm.notas,
          }),
        });
        setToast('Movimiento registrado.');
      }
      setShowMoveModal(false);
      setEditingMovId(null);
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo guardar el movimiento.');
    }
  };

  const completeMovement = async (movementId: string) => {
    try {
      await api(`/api/movimientos/${movementId}/completar`, { method: 'POST' });
      setToast('Movimiento completado.');
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo completar.');
    }
  };

  const deleteMovement = async () => {
    if (!editingMovId) return;
    if (!window.confirm('¿Seguro que quieres eliminar este movimiento?')) return;

    try {
      await api(`/api/movimientos/${editingMovId}`, { method: 'DELETE' });
      setShowMoveModal(false);
      setEditingMovId(null);
      setToast('Movimiento eliminado.');
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo eliminar.');
    }
  };

  const createGenerator = async () => {
    if (!generatorForm.codigo.trim()) {
      setToast('El código es obligatorio.');
      return;
    }

    try {
      await api('/api/generadores', {
        method: 'POST',
        body: JSON.stringify(generatorForm),
      });
      setShowGeneratorModal(false);
      setGeneratorForm({ codigo: '', modelo: '', ubicacion: 'Oficina', estado: 'en-oficina' });
      setToast('Generador añadido.');
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo guardar.');
    }
  };

  const doLogin = async () => {
    try {
      const result = await api<{ me: User; ok: boolean }>('/api/login', {
        method: 'POST',
        body: JSON.stringify(login),
      });
      setState((current) => ({ ...current, me: result.me }));
      setLoginError('');
      setToast('Sesión iniciada.');
      await refresh();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Error al iniciar sesión.');
    }
  };

  const doLogout = async () => {
    await api('/api/logout', { method: 'POST' });
    setState((current) => ({ ...current, me: null }));
    setToast('Has salido.');
  };

  const addUser = async () => {
    if (!userForm.nombre.trim() || !isValidEmail(userForm.email) || !userForm.password.trim()) {
      setToast('Nombre, email válido y contraseña son obligatorios.');
      return;
    }

    try {
      await api('/api/usuarios', {
        method: 'POST',
        body: JSON.stringify({ ...userForm, email: userForm.email.trim() }),
      });
      setUserForm({ nombre: '', email: '', password: '', rol: 'editor' });
      setToast('Usuario añadido.');
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo añadir.');
    }
  };

  const updateUserRole = async (email: string, rol: Role) => {
    const user = state.usuarios.find((u) => u.email === email);
    if (!user) return;

    try {
      await api('/api/usuarios', {
        method: 'POST',
        body: JSON.stringify({ email, nombre: user.nombre, rol, password: user.password ?? 'temporal123' }),
      });
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo actualizar el rol.');
    }
  };

  const deleteUser = async (email: string) => {
    try {
      await api(`/api/usuarios/${encodeURIComponent(email)}`, { method: 'DELETE' });
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo eliminar.');
    }
  };

  const addRecipient = async () => {
    if (!isValidEmail(recipientEmail)) {
      setToast('Introduce un email válido.');
      return;
    }

    try {
      await api('/api/destinatarios', {
        method: 'POST',
        body: JSON.stringify({ email: recipientEmail.trim() }),
      });
      setRecipientEmail('');
      setToast('Destinatario añadido.');
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo añadir el destinatario.');
    }
  };

  const removeRecipient = async (email: string) => {
    try {
      await api(`/api/destinatarios/${encodeURIComponent(email)}`, { method: 'DELETE' });
      await refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo eliminar.');
    }
  };

  const copySummary = async () => {
    const lines = state.movimientos
      .slice()
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((movement) => {
        const generator = state.generadores.find((gen) => gen.id === movement.generador_id);
        return `${formatDate(movement.fecha)} · ${generator?.codigo ?? '—'} · ${movement.origen} → ${movement.destino} · ${movement.estado}`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      setToast('Resumen copiado al portapapeles.');
    } catch {
      setToast('No se pudo copiar el resumen.');
    }
  };

  const sendSummary = async () => {
    try {
      await api('/api/enviar-resumen', { method: 'POST' });
      setToast('Resumen enviado por email.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo enviar el resumen.');
    }
  };

  const weekDates = getWeekDates();

  return (
    <>
      {!state.me ? (
        <div className="login-shell">
          <div className="login-box">
            <h3>Control de generadores</h3>
            <p>Accede con tu correo corporativo.</p>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={login.email}
                onChange={(event) => setLogin((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={login.password}
                onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))}
              />
            </div>
            <button className="button primary full" onClick={doLogin}>Entrar</button>
            {loginError ? <div className="login-error show">{loginError}</div> : null}
          </div>
        </div>
      ) : null}

      {state.me ? (
        <div className="app-shell">
          <header className="topbar">
            <div>
              <h1>Control de generadores</h1>
              <small>Movimientos y ubicación en tiempo real · Barcelona</small>
            </div>
            <div className="topbar-actions">
              <button className="button ghost" onClick={() => setShowUsers(true)}>
                <Users size={15} /> Usuarios
              </button>
              <button className="button ghost" onClick={() => setShowRecipients(true)}>
                <Mail size={15} /> Destinatarios
              </button>
              {!isReadOnly ? (
                <>
                  <button className="button ghost" onClick={() => setShowGeneratorModal(true)}>
                    <Plus size={15} /> Generador
                  </button>
                  <button className="button primary" onClick={() => openMoveModal()}>
                    <Plus size={15} /> Registrar movimiento
                  </button>
                </>
              ) : null}
              <button className="button ghost" onClick={doLogout}>
                <LogOut size={15} /> Salir
              </button>
            </div>
          </header>

          <div className="user-banner">
            <span>{state.me?.nombre ?? 'Invitado'}</span>
            <span className="role">{state.me?.rol === 'editor' ? 'Editor' : 'Solo lectura'}</span>
          </div>

          <section>
            <p className="section-label">Próximos movimientos</p>
            {pendingMovements.length ? (
              <div className="alerts-strip">
                {pendingMovements.map((movement) => {
                  const generator = state.generadores.find((gen) => gen.id === movement.generador_id);
                  const today = new Date();
                  const target = new Date(`${movement.fecha}T00:00:00`);
                  const diff = Math.round((target.getTime() - today.setHours(0, 0, 0, 0)) / 86400000);
                  const alertType = diff < 0 ? 'urgent' : diff <= 2 ? 'soon' : 'future';
                  const label = diff < 0 ? `Retrasado ${Math.abs(diff)}d` : diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : formatDate(movement.fecha);

                  return (
                    <article key={movement.id} className={`alert-card ${alertType}`}>
                      <div className="alert-top">
                        <span>{label}</span>
                        <span className={transportClass(movement.tipo_transporte)}>{movement.tipo_transporte}</span>
                      </div>
                      <div className="alert-route">{movement.origen} → {movement.destino}</div>
                      <small>{generator?.codigo ?? 'Generador'}</small>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">No hay movimientos pendientes.</div>
            )}
          </section>

          <section>
            <p className="section-label">Generadores</p>
            <div className="generator-grid">
              {state.generadores.map((generator) => {
                const related = state.movimientos.filter((m) => m.generador_id === generator.id && m.estado === 'pendiente');
                return (
                  <article key={generator.id} className="generator-card">
                    <div className="generator-head">
                      <div>
                        <div className="generator-code">{generator.codigo}</div>
                        <div className="generator-model">{generator.modelo}</div>
                      </div>
                      <span className={statusClass(generator.estado)}>{generator.estado === 'estable' ? 'Estable' : generator.estado === 'en-transito' ? 'En tránsito' : 'En oficina'}</span>
                    </div>
                    <div className="location-box">
                      <small>Ubicación actual</small>
                      <div>{generator.ubicacion}</div>
                    </div>
                    {related.length ? (
                      <div className="pending-box">
                        <small>Movimientos pendientes ({related.length})</small>
                        {related.map((movement) => (
                          <div key={movement.id} className="pending-line">
                            <div className="pending-route">{movement.origen} → {movement.destino}</div>
                            <div className="pending-meta">
                              <span>{formatDate(movement.fecha)}</span>
                              {!isReadOnly ? (
                                <>
                                  <button className="mini-button" onClick={() => openEditMovement(movement.id)}><Pencil size={12} /></button>
                                  <button className="mini-button primary" onClick={() => completeMovement(movement.id)}><CheckCircle2 size={12} /></button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!isReadOnly ? (
                      <div className="generator-actions">
                        <button className="button ghost" onClick={() => openMoveModal(generator.id)}>+ Registrar movimiento</button>
                      </div>
                    ) : (
                      <div className="readonly-note">Solo lectura</div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <div className="calendar-header">
              <h3>
                {weekDates[0].toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – {weekDates[6].toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
              </h3>
              <div className="calendar-actions">
                <button className="button ghost" onClick={copySummary}><Copy size={15} /> Copiar resumen</button>
                {!isReadOnly ? (
                  <button className="button primary" onClick={sendSummary}><Mail size={15} /> Enviar resumen por email</button>
                ) : null}
              </div>
            </div>
            <div className="legend">
              <span><i className="legend-dot own"></i>Propio</span>
              <span><i className="legend-dot local"></i>Local</span>
              <span><i className="legend-dot nacex"></i>Nacex</span>
            </div>
            <div className="calendar-grid">
              <div className="calendar-cell header empty"></div>
              {weekDates.map((date) => (
                <div key={date.toISOString()} className="calendar-cell header">
                  {date.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' })}
                </div>
              ))}
              {state.generadores.map((generator) => (
                <>
                  <div key={`${generator.id}-code`} className="calendar-cell row-label">{generator.codigo}</div>
                  {weekDates.map((date) => {
                    const iso = isoDate(date);
                    const movement = state.movimientos.find(
                      (item) => item.generador_id === generator.id && item.fecha === iso && item.estado === 'pendiente',
                    );
                    return movement ? (
                      <div key={`${generator.id}-${iso}`} className={`calendar-cell movement ${movement.tipo_transporte === 'Propio' ? 'own' : movement.tipo_transporte === 'Local' ? 'local' : 'nacex'}`} title={`${movement.origen} → ${movement.destino}`}>
                        {movement.origen} → {movement.destino}
                      </div>
                    ) : (
                      <div key={`${generator.id}-${iso}`} className="calendar-cell empty-cell">
                        {generator.ubicacion}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </section>

          <section>
            <p className="section-label">Actividad reciente</p>
            <div className="movement-list">
              {state.movimientos
                .slice()
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .map((movement) => {
                  const generator = state.generadores.find((gen) => gen.id === movement.generador_id);
                  return (
                    <div key={movement.id} className="movement-row">
                      <span className="date-pill">{formatDate(movement.fecha)}</span>
                      <span className="code-pill">{generator?.codigo ?? '—'}</span>
                      <span className="route-pill">{movement.origen} → {movement.destino}</span>
                      <span className={`state-pill ${movement.estado === 'completado' ? 'done' : 'pending'}`}>{movement.estado === 'completado' ? 'Completado' : 'Pendiente'}</span>
                      {!isReadOnly && movement.estado === 'pendiente' ? (
                        <button className="mini-button" onClick={() => openEditMovement(movement.id)}><Pencil size={12} /></button>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </section>
        </div>
      ) : null}

      {showGeneratorModal ? (
        <div className="modal-overlay" onClick={() => setShowGeneratorModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Nuevo generador</h3>
            <div className="field">
              <label>Código</label>
              <input value={generatorForm.codigo} onChange={(e) => setGeneratorForm({ ...generatorForm, codigo: e.target.value })} />
            </div>
            <div className="field">
              <label>Modelo</label>
              <input value={generatorForm.modelo} onChange={(e) => setGeneratorForm({ ...generatorForm, modelo: e.target.value })} />
            </div>
            <div className="field">
              <label>Ubicación actual</label>
              <input value={generatorForm.ubicacion} onChange={(e) => setGeneratorForm({ ...generatorForm, ubicacion: e.target.value })} />
            </div>
            <div className="field">
              <label>Estado</label>
              <select value={generatorForm.estado} onChange={(e) => setGeneratorForm({ ...generatorForm, estado: e.target.value as GeneratorStatus })}>
                <option value="estable">Estable</option>
                <option value="en-oficina">En oficina</option>
                <option value="en-transito">En tránsito</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setShowGeneratorModal(false)}>Cancelar</button>
              <button className="button primary" onClick={createGenerator}>Guardar</button>
            </div>
          </div>
        </div>
      ) : null}

      {showMoveModal ? (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>{editingMovId ? 'Editar movimiento' : 'Registrar movimiento'}</h3>
            <div className="field">
              <label>Generador</label>
              <select value={moveForm.generadorId} onChange={(e) => setMoveForm({ ...moveForm, generadorId: e.target.value, origen: state.generadores.find((g) => g.id === e.target.value)?.ubicacion ?? moveForm.origen })}>
                {state.generadores.map((generator) => (
                  <option key={generator.id} value={generator.id}>{generator.codigo}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Fecha prevista</label>
              <input type="date" value={moveForm.fecha} onChange={(e) => setMoveForm({ ...moveForm, fecha: e.target.value })} />
            </div>
            <div className="field">
              <label>Recoger en</label>
              <input value={moveForm.origen} onChange={(e) => setMoveForm({ ...moveForm, origen: e.target.value })} list="locations-list" />
            </div>
            <div className="field">
              <label>Entregar en</label>
              <input value={moveForm.destino} onChange={(e) => setMoveForm({ ...moveForm, destino: e.target.value })} list="locations-list" />
            </div>
            <div className="field">
              <label>Tipo de transporte</label>
              <select value={moveForm.tipoTransporte} onChange={(e) => setMoveForm({ ...moveForm, tipoTransporte: e.target.value as TransportType })}>
                <option value="Propio">Movimiento propio</option>
                <option value="Local">Transporte local</option>
                <option value="Nacex">Nacex</option>
              </select>
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea value={moveForm.notas} onChange={(e) => setMoveForm({ ...moveForm, notas: e.target.value })} />
            </div>
            <div className="modal-actions">
              {editingMovId ? <button className="button danger" onClick={deleteMovement}>Eliminar</button> : null}
              <button className="button ghost" onClick={() => setShowMoveModal(false)}>Cancelar</button>
              <button className="button primary" onClick={saveMovement}>Guardar</button>
            </div>
          </div>
        </div>
      ) : null}

      {showUsers ? (
        <div className="modal-overlay" onClick={() => setShowUsers(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Usuarios y permisos</h3>
            <div className="user-list">
              {state.usuarios.map((user) => (
                <div key={user.email} className="manage-row">
                  <span>{user.nombre}</span>
                  <span className="muted">{user.email}</span>
                  <select value={user.rol} onChange={(e) => updateUserRole(user.email, e.target.value as Role)}>
                    <option value="editor">Editor</option>
                    <option value="lector">Solo lectura</option>
                  </select>
                  <button className="mini-delete" onClick={() => deleteUser(user.email)}>Eliminar</button>
                </div>
              ))}
            </div>
            <div className="add-row">
              <input placeholder="Nombre" value={userForm.nombre} onChange={(e) => setUserForm({ ...userForm, nombre: e.target.value })} />
              <input placeholder="email@empresa.com" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
              <input type="password" placeholder="Contraseña" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
              <select value={userForm.rol} onChange={(e) => setUserForm({ ...userForm, rol: e.target.value as Role })}>
                <option value="editor">Editor</option>
                <option value="lector">Solo lectura</option>
              </select>
              <button className="button primary" onClick={addUser}>Añadir</button>
            </div>
            <div className="modal-actions right">
              <button className="button ghost" onClick={() => setShowUsers(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}

      {showRecipients ? (
        <div className="modal-overlay" onClick={() => setShowRecipients(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Destinatarios de notificaciones</h3>
            <div className="user-list">
              {state.destinatarios.length ? state.destinatarios.map((email) => (
                <div key={email} className="manage-row">
                  <span className="grow">{email}</span>
                  <button className="mini-delete" onClick={() => removeRecipient(email)}>Eliminar</button>
                </div>
              )) : <p className="muted">Sin destinatarios todavía.</p>}
            </div>
            <div className="add-row">
              <input placeholder="nombre@empresa.com" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
              <button className="button primary" onClick={addRecipient}>Añadir</button>
            </div>
            <div className="modal-actions right">
              <button className="button ghost" onClick={() => setShowRecipients(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}

      <datalist id="locations-list">
        {state.ubicaciones.map((location) => (
          <option key={location} value={location} />
        ))}
      </datalist>

      {toast ? <div className="toast show">{toast}</div> : null}
    </>
  );
}
