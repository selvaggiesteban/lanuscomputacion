import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

interface SuggestProduct {
  id: string;
  title: string;
  price: number;
  thumbnail: string;
  slug: string;
  brand?: string;
}

interface SearchResponse {
  products: SuggestProduct[];
}

interface SearchBarProps {
  className?: string;
}

export default function SearchBar({ className = "" }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SuggestProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced suggestions (min 2 chars) — keeps D1 read usage low
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: SearchResponse = await res.json();
        setResults(data.products ?? []);
        setOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Search suggestions failed:", err);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goToResults = (term: string) => {
    const q = term.trim();
    if (q) window.location.href = `/busqueda/${encodeURIComponent(q)}`;
  };

  const openProduct = (slug: string) => {
    window.location.href = `/producto/${slug}`;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    goToResults(query);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      openProduct(results[activeIndex].slug);
    }
  };

  const formatPrice = (price: number) => `$ ${price.toLocaleString("es-AR")}`;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <form onSubmit={onSubmit} className="relative w-full">
        <input
          type="text"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          className="w-full h-10 pl-4 pr-12 text-sm border rounded-full bg-ml-bg focus:bg-white focus:border-ml-blue focus:outline-none transition-colors"
          placeholder="Buscar productos, marcas y más..."
          aria-label="Buscar"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        <button
          type="submit"
          className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-ml-blue hover:text-ml-blue-hover"
          aria-label="Buscar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-ml-border rounded-lg shadow-lg overflow-hidden z-50">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-ml-text-secondary">
              Sin resultados para "{query.trim()}"
            </div>
          ) : (
            <ul role="listbox" className="max-h-80 overflow-y-auto">
              {results.map((product, index) => (
                <li key={product.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                      index === activeIndex ? "bg-ml-blue-light" : "hover:bg-gray-50"
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openProduct(product.slug)}
                  >
                    <img
                      src={product.thumbnail}
                      alt=""
                      className="w-10 h-10 object-contain flex-shrink-0"
                      loading="lazy"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-ml-text truncate">{product.title}</span>
                      {product.brand && (
                        <span className="block text-xs text-ml-text-secondary">{product.brand}</span>
                      )}
                    </span>
                    <span className="text-sm font-semibold text-ml-text whitespace-nowrap">
                      {formatPrice(product.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="block w-full px-4 py-2.5 text-sm text-left text-ml-blue hover:bg-gray-50 border-t border-ml-border"
            onClick={() => goToResults(query)}
          >
            Ver todos los resultados para "{query.trim()}"
          </button>
        </div>
      )}
    </div>
  );
}
