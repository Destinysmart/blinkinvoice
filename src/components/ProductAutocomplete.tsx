import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useProducts, type Product } from "@/routes/products";
import { fmtUsd, fmtSats } from "@/lib/format";

type Selection = { desc: string; price: number; currency: "USD" | "BTC"; unit: string };

export function ProductAutocomplete({
  value,
  onChange,
  onSelectProduct,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectProduct: (s: Selection) => void;
  placeholder?: string;
}) {
  const { data: products = [] } = useProducts();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => products.filter((p) => p.is_active), [products]);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return active
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [active, value]);

  useEffect(() => { setHighlight(0); }, [value]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (p: Product) => {
    onSelectProduct({
      desc: p.name,
      price: Number(p.price) || 0,
      currency: p.currency,
      unit: p.unit,
    });
    setOpen(false);
  };

  const showList = open && matches.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(matches[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder ?? "Item description"}
        autoComplete="off"
      />
      {showList && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                i === highlight ? "bg-primary/10 text-foreground" : "hover:bg-foreground/5"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {p.sku && <span className="font-mono">{p.sku}</span>}
                  {p.category && <span>· {p.category}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right font-mono text-xs">
                {p.currency === "USD" ? fmtUsd(p.price) : fmtSats(p.price)}
                <div className="text-[10px] text-muted-foreground">/ {p.unit}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
