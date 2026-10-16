import type { Generator, Movement } from './types';

type SummaryField = { label: string; value: string };
type MovementSummaryOptions = {
  heading?: string;
  emptyMessage?: string;
  highlightedMovementIds?: readonly string[];
  showMovementTitle?: boolean;
  emailCards?: boolean;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`)).replace('.', '');
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
  {
    heading = 'Resumen de movimientos',
    emptyMessage = 'No hay movimientos registrados.',
    highlightedMovementIds = [],
    showMovementTitle = true,
    emailCards = false,
  }: MovementSummaryOptions = {},
) {
  const orderedMovements = [...movements].sort((a, b) =>
    b.fecha.localeCompare(a.fecha) ||
    (b.hora_recogida ?? '').localeCompare(a.hora_recogida ?? '') ||
    b.id.localeCompare(a.id));
  const highlightedIds = new Set(highlightedMovementIds);
  if (!orderedMovements.length) {
    return {
      text: `${heading}:\n\n${emptyMessage}`,
      html: `<div style="font-family: Arial, sans-serif; color: #111827;"><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(emptyMessage)}</p></div>`,
    };
  }

  const summaries = orderedMovements.map((movement, index) => {
    const generator = generators.find((item) => item.id === movement.generador_id);
    const fields = getSummaryFields(movement, generator);
    const title = generator?.codigo ?? movement.generador_id;
    const isHighlighted = highlightedIds.has(movement.id);
    const created = formatTimestamp(movement.creado_en);
    const completed = movement.completado_en ? formatTimestamp(movement.completado_en) : null;
    const emailCardHtml = `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border: 1px solid ${isHighlighted ? '#c2410c' : '#cbd5e1'}; border-collapse: collapse; background-color: ${isHighlighted ? '#fff7ed' : '#ffffff'}; font-family: Arial, sans-serif; color: #111827;">
        <colgroup>
          <col width="15%" style="width: 15%;">
          <col width="35%" style="width: 35%;">
          <col width="15%" style="width: 15%;">
          <col width="35%" style="width: 35%;">
        </colgroup>
        <tbody>
          <tr>
            <td colspan="4" style="padding: 10px 12px; border-bottom: 1px solid #cbd5e1; background-color: ${isHighlighted ? '#ffedd5' : '#eef2f7'}; font-family: Arial, sans-serif; color: #111827; font-size: 14px; line-height: 1.4;">
              <strong>${escapeHtml(`${formatDate(movement.fecha)} · ${title} · ${generator?.modelo ?? ''}`.replace(/ · $/, ''))}</strong>
              ${isHighlighted ? '<span aria-label="Movimiento editado" style="display: inline-block; margin-left: 8px; padding: 2px 5px; background-color: #fed7aa; color: #9a3412; font-size: 10px; font-weight: 700; white-space: nowrap;">MOVIMIENTO EDITADO</span>' : ''}
            </td>
          </tr>
          <tr>
            <td width="15%" style="width: 15%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700;">Origen</td>
            <td width="35%" style="width: 35%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; color: #111827; font-size: 12px; overflow-wrap: break-word;">${escapeHtml(movement.origen)}</td>
            <td width="15%" style="width: 15%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700;">Destino</td>
            <td width="35%" style="width: 35%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; color: #111827; font-size: 12px; overflow-wrap: break-word;">${escapeHtml(movement.destino)}</td>
          </tr>
          <tr>
            <td width="15%" style="width: 15%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700;">Recogida</td>
            <td width="35%" style="width: 35%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; color: #111827; font-size: 12px;">${escapeHtml(formatTime(movement.hora_recogida))}</td>
            <td width="15%" style="width: 15%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700;">Entrega</td>
            <td width="35%" style="width: 35%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; color: #111827; font-size: 12px;">${escapeHtml(formatTime(movement.hora_entrega))}</td>
          </tr>
          <tr>
            <td width="15%" style="width: 15%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700;">Transporte</td>
            <td width="35%" style="width: 35%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; color: #111827; font-size: 12px;">${escapeHtml(movement.tipo_transporte)}</td>
            <td width="15%" style="width: 15%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700;">Estado</td>
            <td width="35%" style="width: 35%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; color: #111827; font-size: 12px;">${escapeHtml(movement.estado)}</td>
          </tr>
          <tr>
            <td width="15%" style="width: 15%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700;">Registrado por</td>
            <td width="35%" style="width: 35%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; color: #111827; font-size: 12px;">${escapeHtml(movement.usuario || '—')}</td>
            <td width="15%" style="width: 15%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700;">Creado</td>
            <td width="35%" style="width: 35%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; color: #111827; font-size: 12px;">${escapeHtml(created)}</td>
          </tr>
          ${completed ? `<tr>
            <td width="15%" style="width: 15%; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; background-color: #f8fafc; color: #475569; font-size: 11px; font-weight: 700;">Completado</td>
            <td colspan="3" style="padding: 5px 7px; border-bottom: 1px solid #e2e8f0; color: #111827; font-size: 12px;">${escapeHtml(completed)}</td>
          </tr>` : ''}
          <tr>
            <td colspan="4" style="padding: 7px 9px; color: #111827; font-size: 12px; line-height: 1.45; overflow-wrap: break-word;">
              <strong style="color: #475569;">Notas / comentarios:</strong> ${escapeHtml(movement.notas?.trim() || 'Sin comentarios')}
            </td>
          </tr>
        </tbody>
      </table>
    `;
    return {
      text: [
        ...(showMovementTitle ? [`Movimiento ${movement.id} · ${title}`] : []),
        ...(isHighlighted ? ['[MOVIMIENTO EDITADO]'] : []),
        ...fields.map(({ label, value }) => `${label}: ${value}`),
      ].join('\n'),
      html: emailCards ? `
        ${index > 0 ? '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%;"><tbody><tr><td height="16" style="height: 16px; line-height: 16px; font-size: 1px;">&nbsp;</td></tr></tbody></table>' : ''}
        ${emailCardHtml}
      ` : `
        <section${isHighlighted ? ' aria-label="Movimiento editado"' : ''} style="margin: 0 0 20px;${isHighlighted ? ' padding: 10px; border: 2px solid #c2410c; border-radius: 8px; background-color: #fff7ed;' : ''}">
          ${showMovementTitle ? `<h3 style="margin: 0 0 8px;">Movimiento ${escapeHtml(movement.id)} · ${escapeHtml(title)}</h3>` : ''}
          ${isHighlighted ? '<p style="margin: 0 0 8px; color: #9a3412; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700;">MOVIMIENTO EDITADO</p>' : ''}
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
