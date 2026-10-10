import { useState, useEffect, useCallback } from "react";
import { getCart, removeFromCart, updateQuantity, clearCart } from "../../lib/cart";
import type { CartItem } from "../../lib/cart";

const WA_NUMBER = "5491153323937";
const TRANSFER = {
  titular: "Esteban Selvaggi",
  cvu: "0000077200132500365889",
  alias: "SELVAGGIESTEAAG.PF",
  cuit: "20-43310259-3",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: Props) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"cart" | "data" | "methods" | "done">("cart");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState<{ totalDiscount: number; couponId: string; code: string } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderId: string; method: string; waUrl: string } | null>(null);

  const refresh = useCallback(() => setItems([...getCart()]), []);

  useEffect(() => {
    refresh();
    window.addEventListener("cart-update", refresh);
    return () => window.removeEventListener("cart-update", refresh);
  }, [refresh]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setStep("cart");
      setError("");
      setCouponCode("");
      setCouponDiscount(null);
      setCouponError("");
    }
  }, [open]);

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
        setCouponDiscount({ totalDiscount: data.totalDiscount, couponId: data.couponId, code: data.code });
      }
    } catch {
      setCouponError("Error al validar cupón");
    }
    setApplyingCoupon(false);
  };

  const handleContinue = () => {
    if (!name.trim() || !email.trim()) {
      setError("Completá nombre y email");
      return;
    }
    setError("");
    setStep("methods");
  };

  const handleOrder = async (method: "transferencia" | "efectivo") => {
    setCheckingOut(true);
    setError("");
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            promo_price: i.promo_price ?? i.price,
          })),
          customer: { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined },
          payment_method: method,
          coupon_id: couponDiscount?.couponId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar");

      const resumen = items.map(i => `${i.title} x${i.quantity}`).join(", ");
      const msg = method === "transferencia"
        ? `Hola! Registré el pedido #${data.order_id.slice(0, 8)} por TRANSFERENCIA. Productos: ${resumen}. Total: $${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}. Ya te envío el comprobante.`
        : `Hola! Quiero coordinar el pedido #${data.order_id.slice(0, 8)} (pago en EFECTIVO). Productos: ${resumen}. Total: $${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}.`;
      setOrderResult({
        orderId: data.order_id,
        method,
        waUrl: `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,
      });
      clearCart();
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    }
    setCheckingOut(false);
  };

  if (!open) return null;

  return (
    <div class="fixed inset-0 z-[100]">
      <div class="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div class="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-drawer animate-slide-in flex flex-col">
        <div class="flex items-center justify-between p-4 border-b">
          <h2 class="font-semibold text-ml-text">
            {step === "done" ? "Pedido registrado" : step === "cart" ? `Carrito (${items.reduce((s, i) => s + i.quantity, 0)})` : "Finalizar compra"}
          </h2>
          <button onClick={onClose} class="p-1 hover:text-ml-blue transition-colors" aria-label="Cerrar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          {step === "done" && orderResult ? (
            <div class="p-4 space-y-4 text-center">
              <p class="font-medium text-green-600">✓ Pedido registrado</p>
              <p class="text-xs text-ml-text-muted">Pedido #{orderResult.orderId.slice(0, 8)}</p>
              {orderResult.method === "transferencia" ? (
                <div class="bg-ml-bg rounded p-3 text-xs text-ml-text-secondary space-y-1 text-left">
                  <p><strong>Titular:</strong> {TRANSFER.titular}</p>
                  <p><strong>CVU:</strong> {TRANSFER.cvu}</p>
                  <p><strong>Alias:</strong> {TRANSFER.alias}</p>
                  <p><strong>CUIT:</strong> {TRANSFER.cuit}</p>
                </div>
              ) : (
                <p class="text-xs text-ml-text-secondary">Nos comunicamos para coordinar la entrega y el pago en efectivo.</p>
              )}
              <a href={orderResult.waUrl} target="_blank" rel="noopener" class="block bg-[#25D366] hover:bg-[#20ba5a] text-white text-sm font-bold py-2.5 rounded-lg transition-colors">
                {orderResult.method === "transferencia" ? "Enviar comprobante por WhatsApp" : "Coordinar por WhatsApp"}
              </a>
              <button onClick={onClose} class="ml-btn-secondary text-sm px-6 py-2">Seguir comprando</button>
            </div>
          ) : items.length === 0 ? (
            <div class="flex flex-col items-center justify-center h-full text-ml-text-muted p-8">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-4 opacity-30">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <p class="font-medium text-ml-text mb-1">Tu carrito est&aacute; vac&iacute;o</p>
              <p class="text-sm mb-4">Agreg&aacute; productos para empezar</p>
              <button onClick={onClose} class="ml-btn-primary text-sm px-6 py-2">Seguir comprando</button>
            </div>
          ) : step === "cart" ? (
            <div>
              {items.map((item, i) => (
                <div key={item.product_id} class={`flex gap-3 p-4 ${i < items.length - 1 ? "border-b" : ""}`}>
                  <a href={`/producto/${item.slug}`} onClick={onClose} class="w-16 h-16 flex-shrink-0 bg-ml-bg rounded overflow-hidden">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} class="w-full h-full object-contain" />
                    ) : (
                      <div class="w-full h-full flex items-center justify-center text-ml-text-muted text-xs">Sin img</div>
                    )}
                  </a>
                  <div class="flex-1 min-w-0">
                    <a href={`/producto/${item.slug}`} onClick={onClose} class="text-sm text-ml-text hover:text-ml-blue line-clamp-2 mb-1">{item.title}</a>
                    <div class="flex items-center gap-2">
                      {item.promo_price && item.promo_price < item.price && (
                        <span class="text-xs text-ml-text-muted line-through">${item.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                      )}
                      <p class={`text-sm font-semibold ${item.promo_price && item.promo_price < item.price ? 'text-red-600' : 'text-ml-text'}`}>
                        ${(item.promo_price ?? item.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div class="flex items-center gap-3 mt-1">
                      <div class="flex items-center border rounded text-xs">
                        <button onClick={() => handleQty(item.product_id, item.quantity - 1)} class="px-2 py-1 hover:bg-ml-bg" disabled={item.quantity <= 1}>-</button>
                        <span class="px-2 py-1 border-x font-medium">{item.quantity}</span>
                        <button onClick={() => handleQty(item.product_id, item.quantity + 1)} class="px-2 py-1 hover:bg-ml-bg">+</button>
                      </div>
                      <button onClick={() => handleRemove(item.product_id)} class="text-xs text-ml-text-muted hover:text-red-500">Eliminar</button>
                    </div>
                  </div>
                  <p class="text-sm font-semibold text-ml-text whitespace-nowrap">${((item.promo_price ?? item.price) * item.quantity).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                </div>
              ))}
            </div>
          ) : step === "methods" ? (
            <div class="p-4 space-y-3">
              <p class="text-xs text-ml-text-muted">Elegí cómo querés pagar:</p>
              <button onClick={() => handleOrder("transferencia")} disabled={checkingOut} class="w-full text-left border rounded p-3 hover:border-ml-blue transition-colors">
                <p class="text-sm font-medium text-ml-text">{checkingOut ? "Procesando..." : "Transferencia bancaria"}</p>
                <p class="text-xs text-ml-text-muted">Transferís y nos mandás el comprobante por WhatsApp</p>
              </button>
              <button onClick={() => handleOrder("efectivo")} disabled={checkingOut} class="w-full text-left border rounded p-3 hover:border-ml-blue transition-colors">
                <p class="text-sm font-medium text-ml-text">{checkingOut ? "Procesando..." : "Efectivo"}</p>
                <p class="text-xs text-ml-text-muted">Pagás en efectivo al recibir el producto</p>
              </button>
              <button onClick={() => setStep("data")} class="text-xs text-ml-blue hover:underline">← Volver a mis datos</button>
            </div>
          ) : (
            <div class="p-4 space-y-4">
              <div class="bg-ml-bg rounded p-3 text-xs text-ml-text-secondary">
                {items.map((item) => (
                  <div key={item.product_id} class="flex justify-between py-1">
                    <span class="line-clamp-1">{item.title} x{item.quantity}</span>
                    <span class="font-medium text-ml-text whitespace-nowrap">${((item.promo_price ?? item.price) * item.quantity).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
              <div class="space-y-3">
                <div>
                  <label class="block text-xs text-ml-text-muted mb-1">Nombre *</label>
                  <input type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} class="ml-input w-full text-sm" placeholder="Tu nombre" />
                </div>
                <div>
                  <label class="block text-xs text-ml-text-muted mb-1">Email *</label>
                  <input type="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} class="ml-input w-full text-sm" placeholder="tu@email.com" />
                </div>
                <div>
                  <label class="block text-xs text-ml-text-muted mb-1">Tel&eacute;fono (opcional)</label>
                  <input type="tel" value={phone} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} class="ml-input w-full text-sm" placeholder="11 5332-3937" />
                </div>
              </div>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div class="border-t p-4 space-y-3">
            <div class="space-y-1 text-sm mb-2">
              <div class="flex justify-between">
                <span class="text-ml-text-muted">Subtotal</span>
                <span class="font-medium">${subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
              {discount > 0 && (
                <div class="flex justify-between text-green-600">
                  <span>Descuento ({couponDiscount?.code})</span>
                  <span class="font-medium">-${discount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div class="flex justify-between border-t pt-1">
                <span class="font-semibold text-ml-text">Total</span>
                <span class="font-bold text-lg text-ml-text">${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {step === "cart" && (
              <div>
                <label class="block text-xs text-ml-text-muted mb-1">Cupón</label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="Código"
                    value={couponCode}
                    onInput={(e) => setCouponCode((e.target as HTMLInputElement).value.toUpperCase())}
                    class="ml-input flex-1 text-sm font-mono uppercase"
                  />
                  <button onClick={handleApplyCoupon} disabled={applyingCoupon} class="ml-btn-secondary text-xs px-3">
                    {applyingCoupon ? "..." : "OK"}
                  </button>
                </div>
                {couponError && <p class="text-xs text-red-500 mt-1">{couponError}</p>}
                {couponDiscount && <p class="text-xs text-green-600 mt-1">✓ Cupón {couponDiscount.code} aplicado</p>}
              </div>
            )}

            {error && <p class="text-xs text-red-500">{error}</p>}
            {step === "cart" && (
              <button onClick={() => setStep("data")} class="ml-btn-primary w-full text-sm py-3">
                FINALIZAR COMPRA
              </button>
            )}
            {step === "data" && (
              <button onClick={handleContinue} class="ml-btn-primary w-full text-sm py-3">
                Pagar
              </button>
            )}
            <a href="/carrito" onClick={onClose} class="block text-center text-xs text-ml-blue hover:underline">Ver carrito completo</a>
          </div>
        )}
      </div>
    </div>
  );
}
