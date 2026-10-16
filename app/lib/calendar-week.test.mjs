import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterMovementsByWeek,
  getWeekDates,
  getWeekStartDate,
  isValidWeekStart,
} from './calendar-week.ts';
import { buildWeeklyMovementEmail, buildWeeklyMovementSubject } from './weekly-movement-email.ts';

function iso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('calculates Monday-to-Sunday weeks and offsets across month and year boundaries', () => {
  const current = getWeekDates(new Date(2026, 9, 14, 9));
  const previous = getWeekDates(new Date(2026, 9, 14, 9), -1);
  const next = getWeekDates(new Date(2026, 11, 30, 9), 1);

  assert.deepEqual(current.map(iso), [
    '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15',
    '2026-10-16', '2026-10-17', '2026-10-18',
  ]);
  assert.equal(iso(previous[0]), '2026-10-05');
  assert.equal(iso(previous[6]), '2026-10-11');
  assert.equal(iso(next[0]), '2027-01-04');
  assert.equal(iso(next[6]), '2027-01-10');
});

test('filters movements by the selected visible week only', () => {
  const week = getWeekDates(new Date(2026, 9, 14, 9), -1);
  const movements = [
    { id: 'previous', fecha: '2026-10-05' },
    { id: 'current', fecha: '2026-10-09' },
    { id: 'next', fecha: '2026-10-12' },
  ];

  assert.deepEqual(filterMovementsByWeek(movements, week).map(({ id }) => id), ['previous', 'current']);
});

test('accepts only real Monday date strings for manual email week selection', () => {
  assert.equal(isValidWeekStart('2026-10-12'), true);
  assert.equal(isValidWeekStart('2026-10-13'), false);
  assert.equal(isValidWeekStart('2026-02-30'), false);
  assert.equal(isValidWeekStart('2026/10/12'), false);
  assert.throws(() => getWeekStartDate('2026-10-13'), /lunes válido/);
});

test('manual email uses the requested Monday for both subject range and body week', () => {
  const weekStart = getWeekStartDate('2026-10-12');
  const email = buildWeeklyMovementEmail([], [], weekStart);

  assert.equal(email.subjectDateRange, '12-18 oct 2026');
  assert.ok(email.html.includes('Lunes, 12 de octubre de 2026 – Domingo, 18 de octubre de 2026'));
  assert.equal(buildWeeklyMovementSubject(email.subjectDateRange), 'Movimiento Generadores · 12-18 oct 2026');
});
