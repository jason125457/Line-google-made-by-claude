import { useEffect, useState } from 'react';

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Today's local date ("YYYY-MM-DD"). Changes only when the day changes — checked every minute
 * and when the page becomes visible again — so a page left open past midnight moves to the new
 * day (and month) without re-rendering every minute.
 */
export function useToday(): string {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const check = () => setToday(prev => {
      const now = localDate();
      return now === prev ? prev : now;
    });
    const id = window.setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}
