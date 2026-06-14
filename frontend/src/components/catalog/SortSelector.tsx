import { useState } from 'react';

const SORT_OPTIONS = [
  { value: '', label: 'Más relevantes' },
  { value: 'newest', label: 'Más nuevos' },
  { value: 'price_asc', label: 'Menor precio' },
  { value: 'price_desc', label: 'Mayor precio' },
];

interface Props {
  current?: string;
  onChange?: (value: string) => void;
}

export default function SortSelector({ current = '', onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = SORT_OPTIONS.find(o => o.value === current) || SORT_OPTIONS[0];

  return (
    <div class="relative">
      <button
        class="flex items-center gap-2 text-sm text-ml-text-secondary hover:text-ml-blue transition-colors px-2 py-1"
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="20" y2="12" />
          <line x1="12" y1="18" x2="20" y2="18" />
        </svg>
        Ordenar por: <span class="font-medium text-ml-text">{selected.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div class="absolute right-0 top-full mt-1 bg-white border rounded shadow-megamenu min-w-[200px] z-50 animate-fade-in">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              class={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                opt.value === current
                  ? 'bg-ml-blue-light text-ml-blue font-medium'
                  : 'text-ml-text hover:bg-gray-50'
              }`}
              onClick={() => {
                onChange?.(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
