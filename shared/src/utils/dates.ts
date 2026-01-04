/**
 * Date utilities for consistent date handling
 */

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatShortDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(isoString: string): string {
  return `${formatDate(isoString)} at ${formatTime(isoString)}`;
}

export function isBeforeCutoff(cutoffTime: string): boolean {
  return new Date() < new Date(cutoffTime);
}

export function getDefaultCutoffTime(bakeDate: string, hoursBeforeBake: number = 48): string {
  const cutoff = new Date(bakeDate);
  cutoff.setHours(cutoff.getHours() - hoursBeforeBake);
  return cutoff.toISOString();
}

export function isSameDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isInQuietHours(
  startTime: string,
  endTime: string,
  checkTime: Date = new Date()
): boolean {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const currentMinutes = checkTime.getHours() * 60 + checkTime.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (startMinutes <= endMinutes) {
    // Normal range (e.g., 22:00 to 07:00 would NOT be this)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range (e.g., 22:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export function addDays(isoString: string, days: number): string {
  const date = new Date(isoString);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function startOfDay(isoString: string): string {
  const date = new Date(isoString);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function endOfDay(isoString: string): string {
  const date = new Date(isoString);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}
