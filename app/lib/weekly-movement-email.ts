import type { Generator, Movement } from './types';

const TIME_ZONE = 'Europe/Madrid';

type WeekDay = {
  date: string;
  label: string;
  movements: Movement[];
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
    return {
      date: isoDate,
      label: `${label.charAt(0).toLocaleUpperCase('es-ES')}${label.slice(1)}`,
      movements: [],
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

function formatMovementHtml(movement: Movement, generator?: Generator) {
  const title = [generator?.codigo ?? movement.generador_id, generator?.modelo]
    .filter(Boolean)
    .join(' · ');
  const comment = movement.notas?.trim() || 'Sin comentarios';

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; margin: 0 0 10px; border: 1px solid #dbe3ee; border-radius: 4px;">
      <tbody>
        <tr>
          <td style="padding: 12px; font-family: Arial, sans-serif; color: #111827; font-size: 14px; line-height: 1.5; word-break: break-word;">
            <strong>${escapeHtml(`Movimiento ${movement.id} · ${title}`)}</strong><br>
            ${escapeHtml(`${movement.origen} → ${movement.destino}`)}<br>
            <span style="color: #374151;">Recogida: ${escapeHtml(formatTime(movement.hora_recogida))} · Entrega: ${escapeHtml(formatTime(movement.hora_entrega))}</span><br>
            <span style="color: #374151;">${escapeHtml(movement.tipo_transporte)} · ${escapeHtml(movement.estado)}</span><br>
            <span style="color: #374151;">Comentarios: <span style="overflow-wrap: anywhere; word-break: break-word;">${escapeHtml(comment).replace(/\r\n?|\n/g, '<br>')}</span></span>
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
  const dayByDate = new Map<string, WeekDay>(
    weekDays.map((day): [string, WeekDay] => [day.date, day]),
  );

  for (const movement of movements) {
    dayByDate.get(movement.fecha)?.movements.push(movement);
  }

  const generatorsById = new Map<string, Generator>(
    generators.map((generator): [string, Generator] => [generator.id, generator]),
  );
  for (const day of weekDays) {
    day.movements.sort((a, b) => {
      const timeOrder = (a.hora_recogida ?? '').localeCompare(b.hora_recogida ?? '');
      return timeOrder || a.id.localeCompare(b.id);
    });
  }

  const weekMovements = weekDays.flatMap(({ movements: dayMovements }) => dayMovements);
  const pendingCount = weekMovements.filter(({ estado }) => estado === 'pendiente').length;
  const completedCount = weekMovements.filter(({ estado }) => estado === 'completado').length;
  const weekRange = `${weekDays[0].label} – ${weekDays[6].label}`;

  const daysText = weekDays.map((day) => [
    `${day.label}:`,
    day.movements.length
      ? day.movements.map((movement) => formatMovementText(
        movement,
        generatorsById.get(movement.generador_id),
      )).join('\n\n')
      : '  Sin movimientos',
  ].join('\n')).join('\n\n');
  const text = [
    `Calendario semanal de movimientos · ${weekRange}`,
    '',
    daysText,
    '',
    'Resumen semanal',
    `Movimientos: ${weekMovements.length}`,
    `Pendientes: ${pendingCount}`,
    `Completados: ${completedCount}`,
  ].join('\n');

  const daysHtml = weekDays.map((day) => `
    <tr>
      <td style="padding: 10px 12px; background-color: #eef2f7; border-bottom: 1px solid #dbe3ee; font-family: Arial, sans-serif; color: #111827; font-size: 15px; font-weight: bold;">
        ${escapeHtml(day.label)}
      </td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; font-family: Arial, sans-serif; color: #374151; font-size: 14px; line-height: 1.5;">
        ${day.movements.length
          ? day.movements.map((movement) => formatMovementHtml(
            movement,
            generatorsById.get(movement.generador_id),
          )).join('')
          : 'Sin movimientos'}
      </td>
    </tr>
  `).join('');
  const html = `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; max-width: 680px; margin: 0 auto; border-collapse: collapse; font-family: Arial, sans-serif; color: #111827;">
      <tbody>
        <tr>
          <td style="padding: 20px 12px 12px;">
            <h1 style="margin: 0; font-family: Arial, sans-serif; color: #111827; font-size: 22px; line-height: 1.3;">Calendario semanal de movimientos</h1>
            <p style="margin: 6px 0 16px; font-family: Arial, sans-serif; color: #4b5563; font-size: 14px;">${escapeHtml(weekRange)}</p>
          </td>
        </tr>
        <tr>
          <td>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border: 1px solid #dbe3ee; border-collapse: collapse;">
              <tbody>${daysHtml}</tbody>
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
