import { NextResponse } from 'next/server';
import { getEditorFromRequest } from '@/app/lib/auth';
import { getStore } from '@/app/lib/store';
import { sendSummaryEmail } from '@/app/lib/email';

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
}

export async function POST(request: Request) {
  if (!getEditorFromRequest(request)) {
    return NextResponse.json({ error: 'Necesitas una sesión de editor.' }, { status: 403 });
  }

  const state = getStore();
  const recipients = state.destinatarios.length ? state.destinatarios : ['admin@empresa.com'];

  const text = ['Resumen de movimientos:', ...state.movimientos.map((m) => {
    const generator = state.generadores.find((g) => g.id === m.generador_id);
    return `${formatDate(m.fecha)} · ${generator?.codigo ?? '—'} · ${m.origen} → ${m.destino} · ${m.estado}`;
  })].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2>Resumen semanal</h2>
      <table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Generador</th>
            <th>Ruta</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${state.movimientos
            .map((m) => {
              const generator = state.generadores.find((g) => g.id === m.generador_id);
              return `
                <tr>
                  <td>${formatDate(m.fecha)}</td>
                  <td>${generator?.codigo ?? '—'}</td>
                  <td>${m.origen} → ${m.destino}</td>
                  <td>${m.estado}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  const response = await sendSummaryEmail({
    to: recipients,
    subject: 'Resumen semanal de control de generadores',
    html,
    text,
  });

  return NextResponse.json(response);
}
