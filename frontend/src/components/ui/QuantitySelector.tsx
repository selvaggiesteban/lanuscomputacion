import { useState } from 'react';

interface Props {
  value?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
}

export default function QuantitySelector({ value = 1, min = 1, max = 99, onChange }: Props) {
  const [qty, setQty] = useState(value);

  const update = (val: number) => {
    const next = Math.max(min, Math.min(max, val));
    setQty(next);
    onChange?.(next);
  };

  return (
    <div class="flex items-center border rounded overflow-hidden">
      <button
        class="px-3 py-2 text-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-30"
        onClick={() => update(qty - 1)}
        disabled={qty <= min}
        aria-label="Disminuir cantidad"
      >
        -
      </button>
      <input
        type="number"
        value={qty}
        min={min}
        max={max}
        readOnly
        class="w-12 text-center text-sm font-medium border-x py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        class="px-3 py-2 text-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-30"
        onClick={() => update(qty + 1)}
        disabled={qty >= max}
        aria-label="Aumentar cantidad"
      >
        +
      </button>
    </div>
  );
}
