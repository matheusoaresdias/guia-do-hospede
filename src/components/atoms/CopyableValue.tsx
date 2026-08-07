"use client";

import { useState, useCallback } from "react";

interface CopyableValueProps {
  value: string;
  label: string;
}

export function CopyableValue({ value, label }: CopyableValueProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail if clipboard is not available
    }
  }, [value]);

  const canCopy =
    typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-warm-100 min-h-[44px]">
      <div className="flex-1 min-w-0">
        <span className="block text-sm text-warm-500">
          {label}
        </span>
        <span className="block font-mono text-base text-warm-900 truncate">
          {value}
        </span>
      </div>
      {canCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="flex-none inline-flex items-center justify-center h-[44px] min-w-[44px] rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors px-3"
          aria-label={copied ? "Copiado!" : `Copiar ${label}`}
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      )}
    </div>
  );
}
