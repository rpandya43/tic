import { useState } from 'react';

interface GridSizeSelectorProps {
  onSelect: (size: number) => void;
  currentSize: number;
}

const GRID_SIZES = [3, 4, 5];

export default function GridSizeSelector({ onSelect, currentSize }: GridSizeSelectorProps) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-gray-200 text-sm">Grid Size:</span>
      <div className="flex gap-1">
        {GRID_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => onSelect(size)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              currentSize === size
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
          >
            {size}x{size}
          </button>
        ))}
      </div>
    </div>
  );
} 