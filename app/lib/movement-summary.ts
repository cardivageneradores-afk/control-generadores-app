import type { Generator, Movement } from './types';

type SummaryField = { label: string; value: string };
type MovementSummaryOptions = {
  heading?: string;
  emptyMessage?: string;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatTimestamp(timestamp?: string) {
  return timestamp ? new Date(timestamp).toLocaleString('es-ES') : '—';
}

function formatTime(time?: string) {
  return time ? time.slice(0, 5) : 'Sin indicar';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function getMovementDetailFields(movement: Movement): SummaryField[] {
  return [
    { label: 'Hora de recogida', value: formatTime(movement.hora_recogida) },
    { label: 'Hora de entrega', value: formatTime(movement.hora_entrega) },
    { label: 'Transporte', value: movement.tipo_transporte },
    { label: 'Notas / comentarios', value: movement.notas?.trim() || 'Sin comentarios' },
  ];
}

function getSummaryFields(movement: Movement, generator?: Generator): SummaryField[] {
  const details = getMovementDetailFields(movement);
  return [
    { label: 'Fecha', value: formatDate(movement.fecha) },
    {
      label: 'Generador',
      value: [generator?.codigo ?? movement.generador_id, generator?.modelo].filter(Boolean).join(' · '),
    },
    { label: 'Origen', value: movement.origen },
    details[0],
    { label: 'Destino', value: movement.destino },
    ...details.slice(1),
    { label: 'Estado', value: movement.estado },
    { label: 'Registrado por', value: movement.usuario || '—' },
    { label: 'Creado', value: formatTimestamp(movement.creado_en) },
    { label: 'Completado', value: formatTimestamp(movement.completado_en) },
  ];
}

export function buildMovementSummary(
  movements: Movement[],
  generators: Generator[],
  { heading = 'Resumen de movimientos', emptyMessage = 'No hay movimientos registrados.' }: MovementSummaryOptions = {},
) {
  const orderedMovements = [...movements].sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (!orderedMovements.length) {
    return {
      text: `${heading}:\n\n${emptyMessage}`,
      html: `<div style="font-family: Arial, sans-serif; color: #111827;"><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(emptyMessage)}</p></div>`,
    };
  }

  const summaries = orderedMovements.map((movement) => {
    const generator = generators.find((item) => item.id === movement.generador_id);
    const fields = getSummaryFields(movement, generator);
    const title = generator?.codigo ?? movement.generador_id;
    return {
      text: [
        `Movimiento ${movement.id} · ${title}`,
        ...fields.map(({ label, value }) => `${label}: ${value}`),
      ].join('\n'),
      html: `
        <section style="margin: 0 0 20px;">
          <h3 style="margin: 0 0 8px;">Movimiento ${escapeHtml(movement.id)} · ${escapeHtml(title)}</h3>
          <table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%;">
            <tbody>
              ${fields.map(({ label, value }) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}
            </tbody>
          </table>
        </section>
      `,
    };
  });

  return {
    text: `${heading}:\n\n${summaries.map(({ text }) => text).join('\n\n')}`,
    html: `<div style="font-family: Arial, sans-serif; color: #111827;"><h2>${escapeHtml(heading)}</h2>${summaries.map(({ html }) => html).join('')}</div>`,
  };
}
