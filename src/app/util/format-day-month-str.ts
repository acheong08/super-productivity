import { DatePipe } from '@angular/common';

/**
 * Formats a date as day string with short date in locale-aware format
 * @param dateStr - The date string in YYYY-MM-DD format
 * @param locale - The locale string (e.g., 'en-US', 'de-DE')
 * @returns The formatted day and date string in the specified locale
 */
export const formatDayMonthStr = (dateStr: string, locale: string): string => {
  // Parse the date string as local date parts to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const dayName = date.toLocaleDateString(locale, { weekday: 'short' });

  // Use Angular's DatePipe for locale-aware date formatting
  const datePipe = new DatePipe(locale);
  const shortDate = datePipe.transform(date, 'shortDate') || '';

  // Remove year from the date (same logic as formatMonthDay)
  let dateOnly = shortDate.replace(/[/.\-\s]+\d{2,4}\.?$/, '');
  dateOnly = dateOnly.replace(/^\d{4}[/.\-\s]+/, '');

  return `${dayName} ${dateOnly}`;
};
