"use client";

export function Stars({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Nível em estrelas">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={`text-lg leading-none transition ${
            n <= value ? "text-amber-400" : "text-emerald-800/80"
          } ${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
          aria-pressed={n <= value}
        >
          ★
        </button>
      ))}
    </div>
  );
}
