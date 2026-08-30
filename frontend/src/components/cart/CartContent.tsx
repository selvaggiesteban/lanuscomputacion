import { useState, useEffect, useCallback } from "react";
import { getCart, removeFromCart, updateQuantity, getCartTotal, clearCart } from "../../lib/cart";
import type { CartItem } from "../../lib/cart";

export default function CartContent() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", address: "" });
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState<{ totalDiscount: number; couponId: string; code: string } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const refresh = useCallback(() => setItems([...getCart()]), []);

  useEffect(() => {
    refresh();
    window.addEventListener("cart-update", refresh);
    return () => window.removeEventListener("cart-update", refresh);
  }, [refresh]);

  const handleRemove = (id: string) => {
    removeFromCart(id);
    refresh();
  };

  const handleQty = (id: string, qty: number) => {
    updateQuantity(id, qty);
    refresh();
  };

  const subtotal = items.reduce((s, i) => (i.promo_price ?? i.price) * i.quantity + s, 0);
  const discount = couponDiscount?.totalDiscount ?? 0;
  const total = subtotal - discount;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    setCouponError("");
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          cartTotal: subtotal,
          items: items.map(i => ({
            productId: i.product_id,
            categoryId: i.category_id ?? "",
            price: i.promo_price ?? i.price,
          })),
        }),
      });
      const data = await res.json();
      if (!data.valid) {
        setCouponError(data.error);
        setCouponDiscount(null);
      } else {
        setCouponDiscount({
          totalDiscount: data.totalDiscount,
          couponId: data.couponId,
          code: data.code,
        });
      }
    } catch {
      setCouponError("Error al validar cupón");
    }
    setApplyingCoupon(false);
  };

  const handleCheckout = async () => {
    if (!customer.name || !customer.email) {
      setError("Completá nombre y email");
      return;
    }
    setCheckingOut(true);
    setError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            promo_price: i.promo_price ?? i.price,
          })),
          customer,
          coupon_id: couponDiscount?.couponId ?? null,
        }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Error del servidor. Intentá de nuevo.");
      }
      if (!res.ok) throw new Error(data.error || "Error al procesar");
      if (data.init_point) {
        clearCart();
        window.location.href = data.init_point;
        return;
      }
    } catch (e: any) {
      setError(e.message);
    }
    setCheckingOut(false);
  };

  if (items.length === 0) {
    return (
      <div class="bg-white rounded shadow-card p-8 text-center text-ml-text-muted">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mx-auto mb-4 opacity-30">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <p class="text-lg font-medium text-ml-text mb-2">Tu carrito está vacío</p>
        <p class="text-sm mb-6">Agregá productos para empezar a comprar</p>
        <a href="/" class="ml-btn-primary inline-block">Ver productos</a>
      </div>
    );
  }

  return (
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <div class="bg-white rounded shadow-card">
          {items.map((item, i) => (
            <div class={`flex gap-4 p-4 ${i < items.length - 1 ? "border-b" : ""}`}>
              <a href={`/producto/${item.slug}`} class="w-20 h-20 flex-shrink-0 bg-ml-bg rounded overflow-hidden">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt={item.title} class="w-full h-full object-contain" />
                ) : (
                  <div class="w-full h-full flex items-center justify-center text-ml-text-muted text-xs">Sin img</div>
                )}
              </a>
              <div class="flex-1 min-w-0">
                <a href={`/producto/${item.slug}`} class="text-sm text-ml-text hover:text-ml-blue line-clamp-2 mb-1">{item.title}</a>
                <div class="flex items-center gap-2">
                  {item.promo_price && item.promo_price < item.price && (
                    <span class="text-xs text-ml-text-muted line-through">${item.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  )}
                  <p class={`text-base font-semibold ${item.promo_price && item.promo_price < item.price ? 'text-red-600' : 'text-ml-text'}`}>
                    ${(item.promo_price ?? item.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div class="flex items-center gap-3 mt-2">
                  <div class="flex items-center border rounded text-sm">
                    <button onClick={() => handleQty(item.product_id, item.quantity - 1)} class="px-2 py-1 hover:bg-ml-bg" disabled={item.quantity <= 1}>-</button>
                    <span class="px-3 py-1 border-x font-medium">{item.quantity}</span>
                    <button onClick={() => handleQty(item.product_id, item.quantity + 1)} class="px-2 py-1 hover:bg-ml-bg">+</button>
                  </div>
                  <button onClick={() => handleRemove(item.product_id)} class="text-xs text-ml-text-muted hover:text-red-500 transition-colors">
                    Eliminar
                  </button>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <p class="text-sm font-semibold text-ml-text">${((item.promo_price ?? item.price) * item.quantity).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div class="bg-white rounded shadow-card p-4 sticky top-20">
          <h3 class="text-sm font-medium text-ml-text mb-3">Resumen</h3>
          <div class="space-y-2 text-sm mb-4">
            <div class="flex justify-between">
              <span class="text-ml-text-muted">Productos ({items.reduce((s, i) => s + i.quantity, 0)})</span>
              <span class="font-medium">${subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
            </div>
            {discount > 0 && (
              <div class="flex justify-between text-green-600">
                <span>Descuento ({couponDiscount?.code})</span>
                <span class="font-medium">-${discount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div class="flex justify-between border-t pt-2">
              <span class="font-semibold text-ml-text">Total</span>
              <span class="font-bold text-lg text-ml-text">${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-xs text-ml-text-muted mb-1">Cupón de descuento</label>
            <div class="flex gap-2">
              <input
                type="text"
                placeholder="Código"
                value={couponCode}
                onChange={e => setCouponCode((e.target as HTMLInputElement).value.toUpperCase())}
                class="ml-input flex-1 text-sm font-mono uppercase"
              />
              <button onClick={handleApplyCoupon} disabled={applyingCoupon} class="ml-btn-secondary text-sm px-3">
                {applyingCoupon ? "..." : "Aplicar"}
              </button>
            </div>
            {couponError && <p class="text-xs text-red-500 mt-1">{couponError}</p>}
            {couponDiscount && (
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs text-green-600 font-medium">✓ Cupón {couponDiscount.code} aplicado</span>
                <button onClick={() => { setCouponDiscount(null); setCouponCode(""); }} class="text-xs text-ml-text-muted hover:text-red-500">Quitar</button>
              </div>
            )}
          </div>

          <div class="space-y-2 mb-4">
            <input type="text" placeholder="Nombre completo *" value={customer.name} onChange={e => setCustomer(p => ({ ...p, name: (e.target as HTMLInputElement).value }))} class="ml-input w-full text-sm" />
            <input type="email" placeholder="Email *" value={customer.email} onChange={e => setCustomer(p => ({ ...p, email: (e.target as HTMLInputElement).value }))} class="ml-input w-full text-sm" />
            <input type="tel" placeholder="Teléfono" value={customer.phone} onChange={e => setCustomer(p => ({ ...p, phone: (e.target as HTMLInputElement).value }))} class="ml-input w-full text-sm" />
            <input type="text" placeholder="Dirección" value={customer.address} onChange={e => setCustomer(p => ({ ...p, address: (e.target as HTMLInputElement).value }))} class="ml-input w-full text-sm" />
          </div>

          {error && <p class="text-xs text-red-500 mb-2">{error}</p>}

          <button onClick={handleCheckout} disabled={checkingOut} class="ml-btn-primary w-full text-sm py-3">
            {checkingOut ? "Procesando..." : "Pagar con Mercado Pago"}
          </button>

          <div class="bg-ml-bg rounded p-3 text-xs text-ml-text-secondary space-y-1 mt-3">
            <p class="font-medium text-ml-text">O transferencia bancaria</p>
            <p><strong>Titular:</strong> Esteban Selvaggi</p>
            <p><strong>CBU:</strong> 0720039788000001113604</p>
            <p><strong>CUIT:</strong> 20-43310259-3</p>
            <p><strong>Banco:</strong> Santander SA</p>
            <p><strong>Cuenta:</strong> 039-011136/0</p>
            <p class="text-ml-text-muted">Envíá el comprobante por WhatsApp</p>
          </div>
        </div>
      </div>
    </div>
  );
}
