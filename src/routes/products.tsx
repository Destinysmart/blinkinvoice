import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtUsd, fmtSats } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/products")({
  component: ProductsPage,
});

export type Product = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: "USD" | "BTC";
  unit: string;
  sku: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ProductInput = {
  name: string;
  description: string;
  price: number;
  currency: "USD" | "BTC";
  unit: string;
  sku: string;
  category: string;
  is_active: boolean;
};

const emptyInput: ProductInput = {
  name: "", description: "", price: 0, currency: "USD",
  unit: "unit", sku: "", category: "", is_active: true,
};

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
}

function ProductsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useProducts();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const saveMut = useMutation({
    mutationFn: async (input: ProductInput & { id?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        name: input.name.trim(),
        description: input.description.trim() || null,
        price: Number(input.price) || 0,
        currency: input.currency,
        unit: input.unit.trim() || "unit",
        sku: input.sku.trim() || null,
        category: input.category.trim() || null,
        is_active: input.is_active,
      };
      if (input.id) {
        const { error } = await supabase
          .from("products").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products").insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Product updated" : "Product added");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save product"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("products").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setOpen(true); };
  const onDelete = (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    deleteMut.mutate(p.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-4xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable products and services. Auto-fill them into invoice line items.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> New product
        </Button>
      </div>

      {products.length > 0 && (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Create reusable products to speed up invoice creation."
          action={<Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> New product</Button>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full">
              <thead className="border-b border-border bg-[var(--surface)] text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">SKU</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-left font-medium">Unit</th>
                  <th className="px-4 py-3 text-center font-medium">Active</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-[var(--surface)]">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{p.name}</span>
                        {p.description && (
                          <span className="line-clamp-1 text-xs text-muted-foreground">{p.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      {p.category ? (
                        <span className="rounded-full border border-border bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {p.category}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {p.currency === "USD" ? fmtUsd(p.price) : fmtSats(p.price)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">/ {p.unit}</td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={(v) => toggleActive.mutate({ id: p.id, is_active: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(p)}
                          title="Delete"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      {!p.is_active && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </div>
                    {p.sku && <div className="font-mono text-[11px] text-muted-foreground">{p.sku}</div>}
                  </div>
                  <div className="text-right font-mono text-sm">
                    {p.currency === "USD" ? fmtUsd(p.price) : fmtSats(p.price)}
                    <div className="text-[11px] text-muted-foreground">/ {p.unit}</div>
                  </div>
                </div>
                {p.category && (
                  <span className="inline-block rounded-full border border-border bg-[var(--surface)] px-2 py-0.5 text-[11px] text-muted-foreground">
                    {p.category}
                  </span>
                )}
                <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(p)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ProductSheet
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        initial={editing}
        onSave={(data) => saveMut.mutate({ ...data, id: editing?.id })}
        saving={saveMut.isPending}
      />
    </div>
  );
}

function ProductSheet({
  open, onOpenChange, initial, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Product | null;
  onSave: (input: ProductInput) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ProductInput>(emptyInput);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        name: initial.name,
        description: initial.description ?? "",
        price: Number(initial.price) || 0,
        currency: initial.currency,
        unit: initial.unit,
        sku: initial.sku ?? "",
        category: initial.category ?? "",
        is_active: initial.is_active,
      } : emptyInput);
    }
  }, [open, initial]);

  const submit = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    onSave(form);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit product" : "New product"}</SheetTitle>
          <SheetDescription>
            Saved products appear as suggestions when typing a line item description.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Longer product description (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Price *</Label>
              <Input
                type="number" min={0} step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v: "USD" | "BTC") => setForm({ ...form, currency: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="BTC">BTC (sats)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="hour, session, piece…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">SKU</Label>
              <Input
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="e.g. DSGN-001"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Design, Consulting, Digital…"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-[var(--surface)] px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Inactive products won't appear in invoice suggestions.</div>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add product"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
