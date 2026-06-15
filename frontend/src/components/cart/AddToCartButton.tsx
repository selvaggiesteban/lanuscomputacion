import { useState, useCallback, useEffect } from "react";
import { addToCart, getCartCount } from "../../lib/cart";

type Props = {
  productId: string;
  title: string;
  price: number;
  thumbnail: string;
  slug: string;
  availableQty: number;
};

export default function AddToCartButton({ productId, title, price, thumbnail, slug, availableQty }: Props) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [count, setCount] = useState(0);

  const updateCount = useCallback(() => setCount(getCartCount()), []);

  useEffect(() => {
    updateCount();
    window.addEventListener("cart-update", updateCount);
    return () => window.removeEventListener("cart-update", updateCount);
  }, [updateCount]);

  const handleAdd = () => {
    addToCart({ product_id: productId, title, price, thumbnail, slug }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div>
      <div class="flex items-center gap-2 mb-3">
        {availableQty > 1 && (
          <div class="flex items-center border rounded">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              class="px-3 py-1 text-lg hover:bg-ml-bg transition-colors"
              disabled={qty <= 1}
            >-</button>
            <span class="px-3 py-1 text-sm font-medium border-x min-w-[40px] text-center">{qty}</span>
            <button
              onClick={() => setQty(Math.min(availableQty, qty + 1))}
              class="px-3 py-1 text-lg hover:bg-ml-bg transition-colors"
              disabled={qty >= availableQty}
            >+</button>
          </div>
        )}
      </div>
      <button
        onClick={handleAdd}
        class={`w-full text-base py-4 flex items-center justify-center gap-2 rounded transition-all font-medium ${
          added
            ? "bg-ml-green text-white"
            : "ml-btn-secondary"
        }`}
      >
        {added ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Agregado
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Agregar al carrito
          </>
        )}
      </button>
      <p class="text-xs text-ml-text-muted text-center mt-2">
        ({count} {count === 1 ? "producto" : "productos"} en carrito)
      </p>
    </div>
  );
}
