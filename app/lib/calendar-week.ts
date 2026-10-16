export function getWeekDates(now = new Date(), weekOffset = 0) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

export function filterMovementsByWeek<T extends { fecha: string }>(movements: T[], weekDates: Date[]) {
  const dates = new Set(weekDates.map((date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`));
  return movements.filter((movement) => dates.has(movement.fecha));
}

export function isValidWeekStart(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value
    && date.getUTCDay() === 1;
}

export function getWeekStartDate(value: string) {
  if (!isValidWeekStart(value)) {
    throw new Error('La fecha de inicio debe ser un lunes válido en formato AAAA-MM-DD.');
  }
  return new Date(`${value}T12:00:00Z`);
}
