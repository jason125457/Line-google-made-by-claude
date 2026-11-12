/**
 * Comprehensive date parsing and sorting utilities for Taiwan/Google Sheets format.
 * Handles:
 * - Chinese datetime with 上午/下午 or AM/PM (e.g. "2026/5/9 下午 8:46:31")
 * - 24-hour datetime (e.g. "2026-05-09 20:46:31" or "2026/5/9 20:46:31")
 * - Unpadded date strings (e.g. "2026/5/9" or "2026-5-9")
 * - Excel date serial numbers (e.g. 46143 or 46143.8656)
 * - ISO string timestamps (e.g. "2026-05-09T12:46:31.000Z")
 */

export function parseFlexibleDate(raw: unknown): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // 1. Excel date serial number (e.g. 46143 or 46143.8656)
  const num = typeof raw === 'number' ? raw : parseFloat(s);
  if (!isNaN(num) && num > 35000 && num < 65000 && !s.includes('-') && !s.includes('/')) {
    const ms = Math.round((num - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return new Date(ms + d.getTimezoneOffset() * 60000);
  }

  // 2. Date with optional 上午/下午 or AM/PM and optional time (12- or 24-hour)
  // e.g. "2026/5/9 下午 8:46:31", "2026-05-09 20:46:31", "2026/5/9"
  const match12 = s.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(上午|下午|AM|PM))?(?:\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/i
  );
  if (match12) {
    const year = parseInt(match12[1], 10);
    const month = parseInt(match12[2], 10) - 1;
    const day = parseInt(match12[3], 10);
    const period = match12[4] || '';
    let hour = match12[5] != null ? parseInt(match12[5], 10) : 0;
    const minute = match12[6] != null ? parseInt(match12[6], 10) : 0;
    const second = match12[7] != null ? parseInt(match12[7], 10) : 0;

    if (period === '下午' || period.toUpperCase() === 'PM') {
      if (hour < 12) hour += 12;
    } else if (period === '上午' || period.toUpperCase() === 'AM') {
      if (hour === 12) hour = 0;
    }
    return new Date(year, month, day, hour, minute, second);
  }

  // 3. ISO or standard Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d;
  }

  return null;
}

/**
 * Normalizes any raw date string to a zero-padded, standardized format:
 * - "YYYY-MM-DD HH:mm:ss" if time is present
 * - "YYYY-MM-DD" if date only
 */
export function formatDate(rawDate: unknown): string {
  if (rawDate == null) return '';
  const trimmed = String(rawDate).trim();
  if (!trimmed) return '';

  const d = parseFlexibleDate(rawDate);
  if (!d) return trimmed;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = d.getHours();
  const minute = d.getMinutes();
  const second = d.getSeconds();

  const hasTime = hour !== 0 || minute !== 0 || second !== 0 || trimmed.includes(':');
  if (hasTime) {
    const hStr = String(hour).padStart(2, '0');
    const mStr = String(minute).padStart(2, '0');
    const sStr = String(second).padStart(2, '0');
    return `${year}-${month}-${day} ${hStr}:${mStr}:${sStr}`;
  }
  return `${year}-${month}-${day}`;
}

/**
 * Converts any date string to numeric timestamp for precise sorting.
 */
export function parseDateToTimestamp(rawDate: string): number {
  if (!rawDate) return 0;
  const d = parseFlexibleDate(rawDate);
  return d ? d.getTime() : 0;
}

/**
 * Chronological comparator for transaction dates.
 * Always compares mathematically by timestamp first, eliminating string ordering bugs.
 * @param asc true for oldest to newest, false for newest to oldest
 */
export function compareTransactionDates(dateA: string, dateB: string, asc: boolean = false): number {
  const timeA = parseDateToTimestamp(dateA);
  const timeB = parseDateToTimestamp(dateB);

  if (timeA !== timeB) {
    return asc ? timeA - timeB : timeB - timeA;
  }
  // Tie breaker: string comparison
  return asc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
}

/**
 * "剛剛" / "5 分鐘前" / "3 小時前" / "2 天前" for a past ISO timestamp. Empty string if invalid.
 */
export function formatRelativeTime(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const minutes = Math.floor((now.getTime() - then) / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  return `${Math.floor(hours / 24)} 天前`;
}

/**
 * Compact list label: "10/07 12:00", or "10/07" when there is no time.
 * Falls back to the raw string when it cannot be parsed.
 */
export function formatShortDateTime(raw: string): string {
  const d = parseFlexibleDate(raw);
  if (!d) return raw;
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  const hasTime = /\d:\d/.test(raw) && (d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0);
  return hasTime
    ? `${md} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : md;
}
