import { GasConfig, Transaction, MonthlySummary, CategoryBudgets, IrregularExpense } from '../types/finance';
import { formatDate } from './dateUtils';
import { normalizeCategory } from '../constants/categories';
import { parseAmount } from './gasApi';

// Bump this when the data schema changes to auto-clear stale cached data
const CACHE_VERSION = 'v7';

const KEYS = {
  GAS_CONFIG: 'finance_dashboard_gas_config',
  CACHED_DATA: 'finance_dashboard_cached_data',
  CACHE_VERSION: 'finance_dashboard_cache_version',
  HIDE_AMOUNTS: 'finance_dashboard_hide_amounts',
};

// Auto-clear old cached data on version bump
(function migrateCacheVersion() {
  try {
    const stored = localStorage.getItem(KEYS.CACHE_VERSION);
    if (stored !== CACHE_VERSION) {
      localStorage.removeItem(KEYS.CACHED_DATA);
      localStorage.setItem(KEYS.CACHE_VERSION, CACHE_VERSION);
    }
  } catch (_) { /* silent */ }
})();

export const getGasConfig = (): GasConfig => {
  try {
    const raw = localStorage.getItem(KEYS.GAS_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse gas config:', e);
  }
  return { webAppUrl: '', secretToken: '', lastSyncTime: '' };
};

export const saveGasConfig = (config: GasConfig): void => {
  try {
    localStorage.setItem(KEYS.GAS_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save gas config:', e);
  }
};

/** Privacy mode (amounts blurred). Per device, survives reloads. */
export const getHideAmounts = (): boolean => {
  try {
    return localStorage.getItem(KEYS.HIDE_AMOUNTS) === '1';
  } catch (_) {
    return false;
  }
};

export const saveHideAmounts = (hide: boolean): void => {
  try {
    localStorage.setItem(KEYS.HIDE_AMOUNTS, hide ? '1' : '0');
  } catch (_) { /* silent */ }
};

export const getCachedData =(): { details: Transaction[]; summary: MonthlySummary[]; budgets?: CategoryBudgets; irregular?: IrregularExpense[]; lastUpdated: string } | null => {
  try {
    const raw = localStorage.getItem(KEYS.CACHED_DATA);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.details)) {
        data.details = data.details.map((d: Transaction) => ({
          ...d,
          amount: typeof d.amount === 'number' ? d.amount : parseAmount(d.amount),
          date: formatDate(d.date),
          category: normalizeCategory(d.category)
        }));
      }
      if (data && Array.isArray(data.summary)) {
        data.summary = data.summary.map((s: MonthlySummary) => ({
          ...s,
          totalExpense: typeof s.totalExpense === 'number' ? s.totalExpense : parseAmount(s.totalExpense)
        }));
      }
      return data;
    }
  } catch (e) {
    console.error('Failed to load cached data:', e);
  }
  return null;
};

export const saveCachedData = (data: { details: Transaction[]; summary: MonthlySummary[]; budgets?: CategoryBudgets; irregular?: IrregularExpense[] }): void => {
  try {
    localStorage.setItem(KEYS.CACHED_DATA, JSON.stringify({
      ...data,
      lastUpdated: new Date().toISOString()
    }));
  } catch (e) {
    console.error('Failed to save cached data:', e);
  }
};
