import { describe, it, expect } from 'vitest';
import { buildMonthInsights, monthProgress } from '../insights';
import { resolveCategoryBudgets } from '../financeCalculations';
import { Transaction, TransactionCategory } from '../../types/finance';

const tx = (date: string, amount: number, category: TransactionCategory = '生活'): Transaction => ({
  id: `${date}-${category}-${amount}`, date, item: 'x', category, amount, month: date.slice(0, 7),
});

// 生活 4500 / 家用 2500 / 社交 1200 / 娛樂 1000 / 雜支 800
const budgets = resolveCategoryBudgets({}, 10000);
const today = new Date(2026, 10, 10); // 2026-11-10, a Tuesday

describe('monthProgress', () => {
  it('counts today as both elapsed and still to pay for', () => {
    expect(monthProgress('2026-11', today)).toEqual({
      daysInMonth: 30, elapsedDays: 10, daysLeft: 21, isCurrent: true, fraction: 10 / 30,
    });
  });
  it('treats another month as finished', () => {
    expect(monthProgress('2026-10', today)).toMatchObject({
      daysInMonth: 31, elapsedDays: 31, daysLeft: 0, isCurrent: false, fraction: 1,
    });
  });
});

describe('buildMonthInsights', () => {
  const byId = (list: ReturnType<typeof buildMonthInsights>, id: string) => list.find(i => i.id === id);

  it('returns nothing for a month without records', () => {
    expect(buildMonthInsights([tx('2026-10-05', 100)], '2026-11', budgets, today)).toEqual([]);
  });

  it('flags the category furthest over budget', () => {
    const list = buildMonthInsights(
      [tx('2026-11-03', 1500, '娛樂'), tx('2026-11-04', 1300, '社交')], '2026-11', budgets, today
    );
    expect(byId(list, 'pace')).toMatchObject({ tone: 'warn', text: '娛樂已超出預算 ', amount: 500 });
  });

  it('flags a category ahead of the calendar before it is over budget', () => {
    const list = buildMonthInsights([tx('2026-11-03', 700, '娛樂')], '2026-11', budgets, today);
    expect(byId(list, 'pace')).toMatchObject({ tone: 'warn', text: '娛樂已用掉 70% 預算，但這個月才過 33%' });
  });

  it('says so when everything is on pace', () => {
    const list = buildMonthInsights([tx('2026-11-03', 300)], '2026-11', budgets, today);
    expect(byId(list, 'pace')).toMatchObject({ tone: 'good' });
  });

  it('compares categories with the same days of last month only', () => {
    const list = buildMonthInsights(
      [tx('2026-11-03', 900, '社交'), tx('2026-10-05', 400, '社交'), tx('2026-10-25', 5000, '社交')],
      '2026-11', budgets, today
    );
    expect(byId(list, 'change')).toMatchObject({ tone: 'warn', text: '社交比上月同期多花 ', amount: 500 });
  });

  it('counts no-spend days up to today and reports the weekend share', () => {
    // 11/07 is a Saturday.
    const list = buildMonthInsights([tx('2026-11-03', 300), tx('2026-11-07', 100)], '2026-11', budgets, today);
    expect(byId(list, 'no-spend')?.text).toBe('這個月有 8 天完全沒花錢');
    expect(byId(list, 'weekend')?.text).toContain('週末支出佔 25%');
  });
});
