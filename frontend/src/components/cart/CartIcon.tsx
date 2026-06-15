import { useState, useEffect, useCallback } from "react";
import { getCartCount } from "../../lib/cart";

export default function CartIcon() {
  const [count, setCount] = useState(0);

  const update = useCallback(() => setCount(getCartCount()), []);

  useEffect(() => {
    update();
    window.addEventListener("cart-update", update);
    return () => window.removeEventListener("cart-update", update);
  }, [update]);

  return (
    <a href="/carrito" class="flex items-center gap-1 hover:text-ml-blue transition-colors relative" title="Carrito">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      <span class="hidden lg:inline">Carrito</span>
      {count > 0 && (
        <span class="absolute -top-2 -right-2 w-4 h-4 bg-ml-blue text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </a>
  );
}
