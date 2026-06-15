export type CartItem = {
  product_id: string;
  title: string;
  price: number;
  quantity: number;
  thumbnail: string;
  slug: string;
};

const STORAGE_KEY = "lanuscom-cart";

export function getCart(): CartItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addToCart(item: Omit<CartItem, "quantity">, quantity = 1): CartItem[] {
  const cart = getCart();
  const existing = cart.find(i => i.product_id === item.product_id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ...item, quantity });
  }
  saveCart(cart);
  return cart;
}

export function removeFromCart(productId: string): CartItem[] {
  const cart = getCart().filter(i => i.product_id !== productId);
  saveCart(cart);
  return cart;
}

export function updateQuantity(productId: string, quantity: number): CartItem[] {
  const cart = getCart();
  const item = cart.find(i => i.product_id === productId);
  if (item) {
    item.quantity = Math.max(1, quantity);
  }
  saveCart(cart);
  return cart;
}

export function getCartCount(): number {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}

export function getCartTotal(): number {
  return getCart().reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function clearCart(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  dispatchCartEvent();
}

function saveCart(cart: CartItem[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  dispatchCartEvent();
}

function dispatchCartEvent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("cart-update"));
}
