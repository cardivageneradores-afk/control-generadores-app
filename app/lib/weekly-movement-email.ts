import type { Generator, Movement } from './types';

const TIME_ZONE = 'Europe/Madrid';

type WeekDay = {
  date: string;
  label: string;
  shortLabel: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getLocalDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getWeekDays(now: Date): WeekDay[] {
  const today = getLocalDate(now);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const weekday = todayDate.getUTCDay();
  todayDate.setUTCDate(todayDate.getUTCDate() - ((weekday + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(todayDate);
    date.setUTCDate(todayDate.getUTCDate() + index);
    const isoDate = date.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
    const shortLabel = new Intl.DateTimeFormat('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    }).format(date);
    return {
      date: isoDate,
      label: `${label.charAt(0).toLocaleUpperCase('es-ES')}${label.slice(1)}`,
      shortLabel: `${shortLabel.charAt(0).toLocaleUpperCase('es-ES')}${shortLabel.slice(1)}`,
    };
  });
}

function formatTime(value?: string) {
  return value ? value.slice(0, 5) : 'Sin indicar';
}

function formatMovementText(movement: Movement, generator?: Generator) {
  const title = [generator?.codigo ?? movement.generador_id, generator?.modelo]
    .filter(Boolean)
    .join(' · ');
  return [
    `Movimiento ${movement.id} · ${title}`,
    `${movement.origen} → ${movement.destino}`,
    `Recogida: ${formatTime(movement.hora_recogida)} · Entrega: ${formatTime(movement.hora_entrega)}`,
    `Transporte: ${movement.tipo_transporte} · Estado: ${movement.estado}`,
    `Comentarios: ${movement.notas?.trim() || 'Sin comentarios'}`,
  ].join('\n');
}

function transportColor(type: Movement['tipo_transporte']) {
  if (type === 'Local') return '#9a6700';
  if (type === 'Nacex') return '#6b46c1';
  return '#0f766e';
}

function formatMovementHtml(movement: Movement) {
  const comment = movement.notas?.trim() || 'Sin comentarios';
  const color = transportColor(movement.tipo_transporte);

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; margin: 0 0 6px; border: 1px solid #dbe3ee; border-collapse: collapse;">
      <tbody>
        <tr>
          <td style="padding: 7px; border-left: 3px solid ${color}; font-family: Arial, sans-serif; color: #111827; font-size: 11px; line-height: 1.4; word-break: break-word;">
            <strong>${escapeHtml(`Movimiento ${movement.id}`)}</strong><br>
            <span style="color: ${color};">${escapeHtml(movement.tipo_transporte)}</span><br>
            <strong style="color: ${color};">${escapeHtml(`${movement.origen} → ${movement.destino}`)}</strong><br>
            Recogida: ${escapeHtml(formatTime(movement.hora_recogida))}<br>
            Entrega: ${escapeHtml(formatTime(movement.hora_entrega))}<br>
            Estado: ${escapeHtml(movement.estado)}<br>
            Comentarios: <span style="overflow-wrap: anywhere; word-break: break-word;">${escapeHtml(comment).replace(/\r\n?|\n/g, '<br>')}</span>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

export function buildWeeklyMovementEmail(
  movements: Movement[],
  generators: Generator[],
  now = new Date(),
) {
  const weekDays = getWeekDays(now);
  const weekDates = new Set(weekDays.map((day) => day.date));
  const weekMovements = movements.filter((movement) => weekDates.has(movement.fecha));
  const generatorsById = new Map<string, Generator>(
    generators.map((generator): [string, Generator] => [generator.id, generator]),
  );
  for (const movement of weekMovements) {
    if (!generatorsById.has(movement.generador_id)) {
      generatorsById.set(movement.generador_id, {
        id: movement.generador_id,
        codigo: movement.generador_id,
        modelo: '',
        ubicacion: '',
        estado: 'estable',
      });
    }
  }

  const generatorRows = [...generatorsById.values()];
  const movementsByGeneratorAndDate = new Map<string, Map<string, Movement[]>>();
  for (const movement of weekMovements) {
    const byDate = movementsByGeneratorAndDate.get(movement.generador_id) ?? new Map<string, Movement[]>();
    const cellMovements = byDate.get(movement.fecha) ?? [];
    cellMovements.push(movement);
    byDate.set(movement.fecha, cellMovements);
    movementsByGeneratorAndDate.set(movement.generador_id, byDate);
  }
  for (const byDate of movementsByGeneratorAndDate.values()) {
    for (const cellMovements of byDate.values()) {
      cellMovements.sort((a, b) => {
        const timeOrder = (a.hora_recogida ?? '').localeCompare(b.hora_recogida ?? '');
        return timeOrder || a.id.localeCompare(b.id);
      });
    }
  }

  const pendingCount = weekMovements.filter(({ estado }) => estado === 'pendiente').length;
  const completedCount = weekMovements.filter(({ estado }) => estado === 'completado').length;
  const weekRange = `${weekDays[0].label} – ${weekDays[6].label}`;

  const calendarText = generatorRows.map((generator) => {
    const title = [generator.codigo, generator.modelo].filter(Boolean).join(' · ');
    const cells = weekDays.map((day) => {
      const cellMovements = movementsByGeneratorAndDate.get(generator.id)?.get(day.date) ?? [];
      const content = cellMovements.length
        ? cellMovements.map((movement) => formatMovementText(movement, generator)).join('\n\n')
        : `Ubicación: ${generator.ubicacion?.trim() || '—'}`;
      return `  ${day.label}:\n${content}`;
    });
    return `Generador ${title}\n${cells.join('\n')}`;
  }).join('\n\n');
  const text = [
    `Calendario semanal de movimientos · ${weekRange}`,
    '',
    calendarText || 'Sin generadores',
    '',
    'Resumen semanal',
    `Movimientos: ${weekMovements.length}`,
    `Pendientes: ${pendingCount}`,
    `Completados: ${completedCount}`,
  ].join('\n');

  const headerCells = weekDays.map((day) => `
    <th scope="col" style="width: 12%; padding: 8px 4px; border: 1px solid #dbe3ee; background-color: #eef2f7; font-family: Arial, sans-serif; color: #111827; font-size: 11px; line-height: 1.3; text-align: center;">
      ${escapeHtml(day.shortLabel)}
    </th>
  `).join('');
  const generatorRowsHtml = generatorRows.map((generator) => {
    const cells = weekDays.map((day) => {
      const cellMovements = movementsByGeneratorAndDate.get(generator.id)?.get(day.date) ?? [];
      const content = cellMovements.length
        ? cellMovements.map((movement) => formatMovementHtml(movement)).join('')
        : `<span style="font-size: 10px; color: #4b5563;">Ubicación: ${escapeHtml(generator.ubicacion?.trim() || '—')}</span>`;
      return `
        <td data-calendar-cell="${escapeHtml(`${generator.id}:${day.date}`)}" style="width: 12%; padding: 5px; border: 1px solid #dbe3ee; vertical-align: top; font-family: Arial, sans-serif; color: #374151; font-size: 11px; line-height: 1.4; word-break: break-word;">
          ${content}
        </td>
      `;
    }).join('');
    const title = [generator.codigo, generator.modelo].filter(Boolean).join(' · ');
    return `
      <tr class="generator-row" data-generator-id="${escapeHtml(generator.id)}">
        <th scope="row" style="width: 16%; padding: 7px; border: 1px solid #dbe3ee; background-color: #f8fafc; font-family: Arial, sans-serif; color: #111827; font-size: 11px; line-height: 1.4; text-align: left; vertical-align: top; word-break: break-word;">
          ${escapeHtml(title)}
        </th>
        ${cells}
      </tr>
    `;
  }).join('');
  const html = `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; max-width: 1120px; margin: 0 auto; border-collapse: collapse; font-family: Arial, sans-serif; color: #111827;">
      <tbody>
        <tr>
          <td style="padding: 20px 12px 12px;">
            <h1 style="margin: 0; font-family: Arial, sans-serif; color: #111827; font-size: 22px; line-height: 1.3;">Calendario semanal de movimientos</h1>
            <p style="margin: 6px 0 16px; font-family: Arial, sans-serif; color: #4b5563; font-size: 14px;">${escapeHtml(weekRange)}</p>
          </td>
        </tr>
        <tr>
          <td>
            <table role="table" aria-label="Calendario semanal por generador" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; table-layout: fixed; border: 1px solid #dbe3ee; border-collapse: collapse;">
              <thead>
                <tr>
                  <th scope="col" style="width: 16%; padding: 8px 4px; border: 1px solid #dbe3ee; background-color: #eef2f7; font-family: Arial, sans-serif; color: #111827; font-size: 11px; text-align: left;">Generador</th>
                  ${headerCells}
                </tr>
              </thead>
              <tbody>${generatorRowsHtml}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 22px 12px 8px;">
            <h2 style="margin: 0; font-family: Arial, sans-serif; color: #111827; font-size: 18px; line-height: 1.3;">Resumen semanal</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 12px 20px; font-family: Arial, sans-serif; color: #374151; font-size: 14px; line-height: 1.6;">
            <strong>Movimientos:</strong> ${weekMovements.length}<br>
            <strong>Pendientes:</strong> ${pendingCount}<br>
            <strong>Completados:</strong> ${completedCount}
          </td>
        </tr>
      </tbody>
    </table>
  `;

  return { html, text };
}
