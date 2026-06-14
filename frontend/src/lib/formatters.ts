export function formatPrice(price: number, currency: string = 'ARS'): string {
  if (price == null) return '';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatInstallments(price: number, installments: number = 6, rate: number = 0): string {
  const monthly = rate > 0
    ? price * (1 + rate / 100) / installments
    : price / installments;
  const label = rate > 0 ? `con interés` : `sin interés`;
  return `en ${installments}x $${Math.round(monthly).toLocaleString('es-AR')} ${label}`;
}

export function formatRating(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[-\s]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(text: string, maxLength: number = 60): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}
