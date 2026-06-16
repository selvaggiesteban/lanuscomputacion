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

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({ product_id: productId, title, price, thumbnail, slug }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div>
      {availableQty > 1 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center border rounded">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="px-3 py-1 text-lg hover:bg-ml-bg transition-colors"
              disabled={qty <= 1}
            >-</button>
            <span className="px-3 py-1 text-sm font-medium border-x min-w-[40px] text-center">{qty}</span>
            <button
              onClick={() => setQty(Math.min(availableQty, qty + 1))}
              className="px-3 py-1 text-lg hover:bg-ml-bg transition-colors"
              disabled={qty >= availableQty}
            >+</button>
          </div>
        </div>
      )}
      <button
        onClick={handleAdd}
        className={`w-full text-base py-4 flex items-center justify-center gap-2 rounded transition-all font-medium cursor-pointer ${
          added
            ? "bg-green-500 text-white"
            : "bg-ml-blue text-white hover:bg-ml-blue-hover"
        }`}
      >
        {added ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            ¡Agregado!
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            Agregar al carrito
          </>
        )}
      </button>
      <p className="text-xs text-ml-text-muted text-center mt-2">
        ({count} {count === 1 ? "producto" : "productos"} en carrito)
      </p>
    </div>
  );
}
