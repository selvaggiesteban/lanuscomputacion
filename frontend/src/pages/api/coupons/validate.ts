import type { APIRoute } from 'astro';
import { validateCoupon, applyCouponDiscount } from '../../../lib/d1';

export const POST: APIRoute = async ({ request, locals }) => {
  const { env } = locals as { env: { DB: D1Database } };
  const body = await request.json();
  const { code, cartTotal, items } = body as {
    code: string;
    cartTotal: number;
    items: { productId: string; categoryId: string; price: number }[];
  };

  if (!code || !cartTotal || !items) {
    return new Response(JSON.stringify({ valid: false, error: 'Datos incompletos' }), { status: 400 });
  }

  const result = await validateCoupon(env.DB, code, cartTotal);
  if (!result.valid || !result.coupon) {
    return new Response(JSON.stringify({ valid: false, error: result.error }), { status: 400 });
  }

  let totalDiscount = 0;
  const itemDiscounts = items.map(item => {
    const { discounted, finalPrice } = applyCouponDiscount(
      result.coupon!, item.productId, item.categoryId, item.price
    );
    const saved = discounted ? item.price - finalPrice : 0;
    totalDiscount += saved;
    return { ...item, finalPrice, saved };
  });

  return new Response(JSON.stringify({
    valid: true,
    couponId: result.coupon.id,
    code: result.coupon.code,
    type: result.coupon.type,
    value: result.coupon.value,
    totalDiscount,
    itemDiscounts,
  }));
};
