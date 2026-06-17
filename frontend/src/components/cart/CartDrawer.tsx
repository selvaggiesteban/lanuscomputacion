import { useState, useEffect, useCallback } from "react";
import { getCart, removeFromCart, updateQuantity, getCartTotal, clearCart } from "../../lib/cart";
import type { CartItem } from "../../lib/cart";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: Props) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");

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

  const handleRemove = (id: string) => {
    removeFromCart(id);
    refresh();
  };

  const handleQty = (id: string, qty: number) => {
    updateQuantity(id, qty);
    refresh();
  };

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleCheckout = async () => {
    setCheckingOut(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error("Error del servidor"); }
      if (!res.ok) throw new Error(data.error || "Error al procesar");
      if (data.init_point) {
        clearCart();
        window.location.href = data.init_point;
      }
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
            Carrito ({items.reduce((s, i) => s + i.quantity, 0)})
          </h2>
          <button onClick={onClose} class="p-1 hover:text-ml-blue transition-colors" aria-label="Cerrar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div class="flex flex-col items-center justify-center h-full text-ml-text-muted p-8">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-4 opacity-30">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <p class="font-medium text-ml-text mb-1">Tu carrito está vacío</p>
              <p class="text-sm mb-4">Agregá productos para empezar</p>
              <button onClick={onClose} class="ml-btn-primary text-sm px-6 py-2">Seguir comprando</button>
            </div>
          ) : (
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
                    <p class="text-sm font-semibold text-ml-text">${item.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                    <div class="flex items-center gap-3 mt-1">
                      <div class="flex items-center border rounded text-xs">
                        <button onClick={() => handleQty(item.product_id, item.quantity - 1)} class="px-2 py-1 hover:bg-ml-bg" disabled={item.quantity <= 1}>-</button>
                        <span class="px-2 py-1 border-x font-medium">{item.quantity}</span>
                        <button onClick={() => handleQty(item.product_id, item.quantity + 1)} class="px-2 py-1 hover:bg-ml-bg">+</button>
                      </div>
                      <button onClick={() => handleRemove(item.product_id)} class="text-xs text-ml-text-muted hover:text-red-500">Eliminar</button>
                    </div>
                  </div>
                  <p class="text-sm font-semibold text-ml-text whitespace-nowrap">${(item.price * item.quantity).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div class="border-t p-4 space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-ml-text-muted">Total</span>
              <span class="font-bold text-lg text-ml-text">${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
            </div>
            {error && <p class="text-xs text-red-500">{error}</p>}
            <button onClick={handleCheckout} disabled={checkingOut} class="ml-btn-primary w-full text-sm py-3">
              {checkingOut ? "Procesando..." : "Pagar con Mercado Pago"}
            </button>
            <div class="bg-ml-bg rounded p-3 text-xs text-ml-text-secondary space-y-1">
              <p class="font-medium text-ml-text">O transferencia bancaria</p>
              <p><strong>Titular:</strong> Esteban Selvaggi</p>
              <p><strong>CBU:</strong> 0720039788000001113604</p>
              <p><strong>CUIT:</strong> 20-43310259-3</p>
              <p><strong>Banco:</strong> Santander SA</p>
              <p><strong>Cuenta:</strong> 039-011136/0</p>
              <p class="text-ml-text-muted">Envíá el comprobante por WhatsApp</p>
            </div>
            <a href="/carrito" onClick={onClose} class="block text-center text-xs text-ml-blue hover:underline">Ver carrito completo</a>
          </div>
        )}
      </div>
    </div>
  );
}
