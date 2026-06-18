export type ShipmentHalf = 'FIRST_HALF' | 'SECOND_HALF';

export function getHalfMonthDateRange(yearMonth: string, half: ShipmentHalf) {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  const mm = monthStr.padStart(2, '0');

  if (half === 'FIRST_HALF') {
    return { min: `${year}-${mm}-01`, max: `${year}-${mm}-15` };
  }
  return { min: `${year}-${mm}-16`, max: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

export function formatShipmentPeriodLabel(yearMonth: string, half: ShipmentHalf) {
  const monthName = new Date(`${yearMonth}-01T00:00:00`).toLocaleString('en', { month: 'long' });
  return half === 'FIRST_HALF' ? `First half of ${monthName}` : `Second half of ${monthName}`;
}

export function formatShipmentMonthDb(yearMonth: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [yearStr, monthStr] = yearMonth.split('-');
  const monthIdx = Number(monthStr) - 1;
  return `${months[monthIdx]}-${yearStr.slice(-2)}`;
}

export function parseShipmentMonthDb(value?: string | null): string | undefined {
  if (!value) return undefined;
  const months: Record<string, string> = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  };
  const [mon, yy] = value.split('-');
  const mm = months[mon];
  if (!mm || !yy) return undefined;
  return `20${yy}-${mm}`;
}

export const SHIPMENT_HALF_OPTIONS = [
  { value: 'FIRST_HALF' as ShipmentHalf, label: 'First half of month' },
  { value: 'SECOND_HALF' as ShipmentHalf, label: 'Second half of month' },
];
