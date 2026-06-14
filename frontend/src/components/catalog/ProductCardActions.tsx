import { useState } from 'react';

interface Props {
  productId: string;
  title: string;
  price: number;
  image: string;
  slug: string;
}

export default function ProductCardActions({ productId, title, price, image, slug }: Props) {
  const [isFav, setIsFav] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const addToCart = () => {
    const event = new CustomEvent('startech-add-to-cart', {
      detail: { id: productId, title, price, image, slug, quantity: 1 },
    });
    window.dispatchEvent(event);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const toggleFav = () => {
    setIsFav(!isFav);
    const event = new CustomEvent('startech-toggle-fav', {
      detail: { id: productId, title, price, image, slug },
    });
    window.dispatchEvent(event);
  };

  return (
    <>
      <button
        class="ml-btn-outline text-xs px-3 py-1.5"
        onClick={addToCart}
        aria-label="Agregar al carrito"
      >
        Agregar al carrito
      </button>
      <button
        class={`p-1.5 transition-colors ${isFav ? 'text-red-500' : 'text-ml-text-muted hover:text-red-500'}`}
        onClick={toggleFav}
        aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      {showToast && (
        <div class="fixed bottom-4 right-4 bg-ml-green text-white text-sm font-medium px-4 py-3 rounded shadow-lg animate-fade-in z-50">
          Agregado al carrito
        </div>
      )}
    </>
  );
}
