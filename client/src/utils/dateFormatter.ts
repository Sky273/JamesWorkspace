/**
 * Date formatting utilities for consistent date display across the application
 * Handles PostgreSQL timestamp formats and provides localized formatting
 */

export type DateFormatStyle = 'short' | 'medium' | 'long' | 'relative';

/**
 * Format a date string or Date object to a localized string
 * @param date - Date string (ISO, PostgreSQL timestamp) or Date object
 * @param style - Format style: 'short' (01/02/2024), 'medium' (1 fév. 2024), 'long' (1 février 2024), 'relative' (il y a 2 jours)
 * @param locale - Locale for formatting (default: 'fr-FR')
 * @returns Formatted date string or empty string if invalid
 */
export function formatDate(
  date: string | Date | null | undefined,
  style: DateFormatStyle = 'medium',
  locale: string = 'fr-FR'
): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check for invalid date
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    switch (style) {
      case 'short':
        return dateObj.toLocaleDateString(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        
      case 'medium':
        return dateObj.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        
      case 'long':
        return dateObj.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        
      case 'relative':
        return formatRelativeDate(dateObj, locale);
        
      default:
        return dateObj.toLocaleDateString(locale);
    }
  } catch {
    return '';
  }
}

/**
 * Format a date with time
 * @param date - Date string or Date object
 * @param includeSeconds - Whether to include seconds
 * @param locale - Locale for formatting
 * @returns Formatted date and time string
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  includeSeconds: boolean = false,
  locale: string = 'fr-FR'
): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds && { second: '2-digit' })
    };
    
    return dateObj.toLocaleString(locale, options);
  } catch {
    return '';
  }
}

/**
 * Format a relative date (e.g., "il y a 2 jours", "dans 3 heures")
 * @param date - Date object
 * @param locale - Locale for formatting
 * @returns Relative date string
 */
function formatRelativeDate(date: Date, locale: string = 'fr-FR'): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  const isFrench = locale.startsWith('fr');
  
  // Future dates
  if (diffMs < 0) {
    const absDiffDays = Math.abs(diffDays);
    if (absDiffDays === 0) return isFrench ? "Aujourd'hui" : 'Today';
    if (absDiffDays === 1) return isFrench ? 'Demain' : 'Tomorrow';
    if (absDiffDays < 7) return isFrench ? `Dans ${absDiffDays} jours` : `In ${absDiffDays} days`;
    return formatDate(date, 'medium', locale);
  }
  
  // Past dates
  if (diffSeconds < 60) {
    return isFrench ? "À l'instant" : 'Just now';
  }
  
  if (diffMinutes < 60) {
    return isFrench 
      ? `Il y a ${diffMinutes} min` 
      : `${diffMinutes} min ago`;
  }
  
  if (diffHours < 24) {
    return isFrench 
      ? `Il y a ${diffHours}h` 
      : `${diffHours}h ago`;
  }
  
  if (diffDays === 1) {
    return isFrench ? 'Hier' : 'Yesterday';
  }
  
  if (diffDays < 7) {
    return isFrench 
      ? `Il y a ${diffDays} jours` 
      : `${diffDays} days ago`;
  }
  
  if (diffWeeks < 4) {
    const weeks = diffWeeks;
    return isFrench 
      ? `Il y a ${weeks} sem.` 
      : `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  
  if (diffMonths < 12) {
    return isFrench 
      ? `Il y a ${diffMonths} mois` 
      : `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  }
  
  return isFrench 
    ? `Il y a ${diffYears} an${diffYears > 1 ? 's' : ''}` 
    : `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
}

/**
 * Format a date for display in a table or list (compact format)
 * Shows relative for recent dates, absolute for older ones
 * @param date - Date string or Date object
 * @param locale - Locale for formatting
 * @returns Formatted date string
 */
export function formatDateSmart(
  date: string | Date | null | undefined,
  locale: string = 'fr-FR'
): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Use relative for dates within last 7 days
    if (diffDays >= 0 && diffDays < 7) {
      return formatRelativeDate(dateObj, locale);
    }
    
    // Use medium format for older dates
    return formatDate(dateObj, 'medium', locale);
  } catch {
    return '';
  }
}

/**
 * Format a period/quarter string (e.g., "2024-T3" -> "3ème trimestre 2024")
 * @param period - Period string in format "YYYY-TX" or "YYYY-MM"
 * @param locale - Locale for formatting
 * @returns Formatted period string
 */
export function formatPeriod(
  period: string | null | undefined,
  locale: string = 'fr-FR'
): string {
  if (!period) return '';
  
  const isFrench = locale.startsWith('fr');
  
  // Handle quarter format (2024-T3)
  const quarterMatch = period.match(/^(\d{4})-T(\d)$/);
  if (quarterMatch) {
    const [, year, quarter] = quarterMatch;
    if (isFrench) {
      return `${quarter}${quarter === '1' ? 'er' : 'ème'} trimestre ${year}`;
    }
    return `Q${quarter} ${year}`;
  }
  
  // Handle month format (2024-03)
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const [, year, month] = monthMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }
  
  // Return as-is if no match
  return period;
}

export default {
  formatDate,
  formatDateTime,
  formatDateSmart,
  formatPeriod
};
