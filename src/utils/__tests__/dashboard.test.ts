import { describe, it, expect } from 'vitest';
import { buildAvailableMonths, averageToDate } from '../financeCalculations';
import { shiftDemoDates } from '../demoData';
import { Transaction } from '../../types/finance';

const tx = (date: string, amount = 100): Transaction => ({
  id: date + amount, date, item: 'x', category: '生活', amount, month: date.slice(0, 7),
});

describe('buildAvailableMonths', () => {
  it('lists months newest first and always includes the current month', () => {
    const months = buildAvailableMonths([tx('2026-09-03'), tx('2026-10-31'), tx('2026-09-20')], [], '2026-11');
    expect(months).toEqual(['2026-11', '2026-10', '2026-09']);
  });
  it('merges summary months and skips malformed ones', () => {
    const months = buildAvailableMonths([tx('2026-10-01')], [{ month: '2026-08', totalExpense: 1 }, { month: '', totalExpense: 1 }], '2026-10');
    expect(months).toEqual(['2026-10', '2026-08']);
  });
  it('stays empty when there is no data at all', () => {
    expect(buildAvailableMonths([], [], '2026-10')).toEqual([]);
  });
});

describe('averageToDate', () => {
  it('scales a monthly average to the elapsed share of the month', () => {
    expect(averageToDate(31000, 10, 31)).toBe(10000);
  });
  it('is the full average for a finished month and never exceeds it', () => {
    expect(averageToDate(20000, 30, 30)).toBe(20000);
    expect(averageToDate(20000, 40, 30)).toBe(20000);
  });
});

describe('shiftDemoDates', () => {
  const rows = [
    { date: '2026-09-04', amount: 1 },
    { date: '2026-09-01', amount: 2 },
    { date: '2026-08-31', amount: 3 },
    { date: '2026-03-05', amount: 4 },
  ];

  it('moves the anchor month onto the current month', () => {
    const out = shiftDemoDates(rows, '2026-09', new Date(2026, 10, 20)); // 2026-11-20
    expect(out.map(r => r.date)).toEqual(['2026-11-04', '2026-11-01', '2026-10-31', '2026-05-05']);
  });
  it('drops rows that would land after today and clamps to shorter months', () => {
    const out = shiftDemoDates(rows, '2026-09', new Date(2027, 2, 2)); // 2027-03-02
    expect(out.map(r => r.date)).toEqual(['2027-03-01', '2027-02-28', '2026-09-05']);
  });
});
