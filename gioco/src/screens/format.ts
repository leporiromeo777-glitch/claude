/**
 * Formati delle date e dei numeri (ARCHITETTURA 10: "date e numeri con Intl").
 */
import type { Locale } from '../core/types';
import { dateObject, dateTag } from './daily';

/**
 * «Martedì 14 ottobre» / «Tuesday 14 October» (o «Tuesday, October 14» per chi ha il
 * browser in inglese americano): la lingua delle date è quella di `dateTag` (SCH-11).
 */
export function longDate(date: string, locale: Locale, tag: string = dateTag(locale)): string {
  try {
    const s = new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }).format(dateObject(date));
    return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  } catch {
    return date;
  }
}

export function formatNumber(n: number, locale: Locale): string {
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'it-IT').format(n);
  } catch {
    return String(n);
  }
}
