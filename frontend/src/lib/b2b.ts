import type { B2bRule } from './d1';

// ── Wholesale (B2B) pricing helpers ─────────────────────────────────────────
// The public wholesale price is computed from DB rules for display only.
// The purchase gate lives in /api/checkout: only users with
// is_b2b = 1 AND b2b_status = 'approved' are actually charged this price.

export type B2bPrice = { price: number; minQuantity: number };

export function pickB2bRule(
  rules: B2bRule[],
  categoryName: string | null | undefined
): B2bRule | null {
  const name = (categoryName ?? '').trim().toLowerCase();
  if (name) {
    const match = rules.find(
      (r) => (r.category_name ?? '').trim().toLowerCase() === name
    );
    if (match) return match;
  }
  return (
    rules.find((r) => (r.category_name ?? '').trim().toLowerCase() === 'default') ??
    null
  );
}

/**
 * Wholesale price for a product.
 * - Base is the list price (never a promo price).
 * - When `displayPrice` is given, returns null if the wholesale price is not
 *   actually lower (e.g. a deeper public promo already applies).
 */
export function getB2bPrice(
  rules: B2bRule[],
  categoryName: string | null | undefined,
  listPrice: number,
  displayPrice?: number
): B2bPrice | null {
  const rule = pickB2bRule(rules, categoryName);
  if (!rule || !(rule.discount_pct > 0)) return null;
  const price = Math.round(listPrice * (1 - rule.discount_pct));
  if (price <= 0 || price >= listPrice) return null;
  if (displayPrice != null && price >= displayPrice) return null;
  return { price, minQuantity: rule.min_quantity > 0 ? rule.min_quantity : 1 };
}

export function isApprovedB2bUser(
  user: { is_b2b?: number; b2b_status?: string | null } | null | undefined
): boolean {
  return !!user && user.is_b2b === 1 && user.b2b_status === 'approved';
}
