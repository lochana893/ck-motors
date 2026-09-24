"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, PackageCheck, Pencil, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type InventoryPart = {
  id: string;
  part_name: string;
  sku: string | null;
  brand: string | null;
  category_id: string | null;
  supplier_id: string | null;
  purchase_price: number | null;
  selling_price: number | null;
  quantity_in_stock: number;
  minimum_stock_level: number;
  unit: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  notes: string | null;
  category?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
};

type StockMovementType = "Stock In" | "Service Usage" | "Manual Stock Out" | "Adjustment" | "Return";

const stockMovementTypeMap: Record<StockMovementType, "stock_in" | "service_usage" | "manual_stock_out" | "adjustment" | "return"> = {
  "Stock In": "stock_in",
  "Service Usage": "service_usage",
  "Manual Stock Out": "manual_stock_out",
  Adjustment: "adjustment",
  Return: "return",
};

const emptyForm = {
  part_name: "",
  sku: "",
  category_id: "",
  brand: "",
  supplier_id: "",
  purchase_price: "",
  selling_price: "",
  quantity_in_stock: "0",
  minimum_stock_level: "0",
  unit: "pcs",
  notes: "",
  is_active: true,
};

const movementTypes: StockMovementType[] = ["Stock In", "Service Usage", "Manual Stock Out", "Adjustment", "Return"];

export default function InventoryManager() {
  const supabase = useMemo(() => createClient(), []);
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryPart | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [movementPart, setMovementPart] = useState<InventoryPart | null>(null);
  const [movementForm, setMovementForm] = useState({ quantity: "1", type: "Stock In" as StockMovementType, notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadInventory = useCallback(async () => {
    const [
      { data: partsData, error: partsError },
      { data: supplierData, error: supplierError },
      { data: categoryData, error: categoryError },
    ] = await Promise.all([
      supabase
        .from("inventory_parts")
        .select(`
          id,
          part_name,
          sku,
          brand,
          category_id,
          supplier_id,
          purchase_price,
          selling_price,
          quantity_in_stock,
          minimum_stock_level,
          unit,
          notes,
          is_active,
          created_at,
          updated_at,
          category:inventory_categories (
            id,
            name
          ),
          supplier:suppliers (
            id,
            name
          )
        `)
        .order("part_name", { ascending: true }),
      supabase.from("suppliers").select("id, name").eq("is_active", true).order("name", { ascending: true }),
      supabase.from("inventory_categories").select("id, name").eq("is_active", true).order("display_order", { ascending: true }),
    ]);

    if (partsError) {
      setError(partsError.message);
      return;
    }

    if (supplierError) {
      setError(supplierError.message);
      return;
    }

    if (categoryError) {
      setError(categoryError.message);
      return;
    }

    const normalizedParts = (partsData || []).map((item) => ({
      ...item,
      category: Array.isArray(item.category) ? item.category[0] || null : item.category,
      supplier: Array.isArray(item.supplier) ? item.supplier[0] || null : item.supplier,
    })) as InventoryPart[];

    setParts(normalizedParts);
    setSuppliers((supplierData || []) as Array<{ id: string; name: string }>);
    setCategories((categoryData || []) as Array<{ id: string; name: string }>);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInventory();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadInventory]);

  function startAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(part: InventoryPart) {
    setEditing(part);
    setForm({
      part_name: part.part_name,
      sku: part.sku || "",
      category_id: part.category_id || "",
      brand: part.brand || "",
      supplier_id: part.supplier_id || "",
      purchase_price: part.purchase_price?.toString() || "0",
      selling_price: part.selling_price?.toString() || "0",
      quantity_in_stock: String(part.quantity_in_stock),
      minimum_stock_level: String(part.minimum_stock_level),
      unit: part.unit || "pcs",
      notes: part.notes || "",
      is_active: part.is_active,
    });
    setShowForm(true);
  }

  async function savePart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      part_name: form.part_name.trim(),
      sku: form.sku.trim() || null,
      category_id: form.category_id || null,
      brand: form.brand.trim() || null,
      supplier_id: form.supplier_id || null,
      purchase_price: Number(form.purchase_price || 0),
      selling_price: Number(form.selling_price || 0),
      quantity_in_stock: Number(form.quantity_in_stock || 0),
      minimum_stock_level: Number(form.minimum_stock_level || 0),
      unit: form.unit || "pcs",
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };

    if (!payload.part_name) {
      setError("Part name is required.");
      setSaving(false);
      return;
    }

    if (editing) {
      const { error: updateError } = await supabase.from("inventory_parts").update(payload).eq("id", editing.id);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      setMessage("Part updated.");
    } else {
      const { error: insertError } = await supabase.from("inventory_parts").insert(payload);
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
      setMessage("Part added.");
    }

    setShowForm(false);
    setForm(emptyForm);
    setEditing(null);
    setSaving(false);
    await loadInventory();
  }

  async function togglePart(part: InventoryPart) {
    const { error: toggleError } = await supabase.from("inventory_parts").update({ is_active: !part.is_active }).eq("id", part.id);

    if (toggleError) {
      setError(toggleError.message);
      return;
    }

    setMessage(`${part.part_name} ${part.is_active ? "deactivated" : "activated"}.`);
    await loadInventory();
  }

  async function commitMovement() {
    if (!movementPart) return;
    const quantity = Number(movementForm.quantity || 0);
    if (!quantity || quantity < 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    const currentQty = movementPart.quantity_in_stock;
    const nextQty =
      movementForm.type === "Stock In" || movementForm.type === "Return"
        ? currentQty + quantity
        : movementForm.type === "Service Usage" || movementForm.type === "Manual Stock Out"
          ? currentQty - quantity
          : currentQty + quantity;

    if (nextQty < 0) {
      setError("Stock cannot go below zero.");
      return;
    }

    const { error: updateError } = await supabase
      .from("inventory_parts")
      .update({ quantity_in_stock: nextQty, updated_at: new Date().toISOString() })
      .eq("id", movementPart.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const { error: movementError } = await supabase.from("stock_movements").insert({
      inventory_part_id: movementPart.id,
      movement_type: stockMovementTypeMap[movementForm.type],
      quantity,
      quantity_before: currentQty,
      quantity_after: nextQty,
      notes: movementForm.notes.trim() || null,
      created_by: userData.user?.id || null,
    });

    if (movementError) {
      const { error: rollbackError } = await supabase
        .from("inventory_parts")
        .update({ quantity_in_stock: currentQty, updated_at: new Date().toISOString() })
        .eq("id", movementPart.id);

      setError(
        rollbackError
          ? `Stock movement failed and quantity rollback failed: ${movementError.message}`
          : `Stock movement failed; quantity was restored: ${movementError.message}`
      );
      return;
    }

    setMovementPart(null);
    setMovementForm({ quantity: "1", type: "Stock In", notes: "" });
    setMessage("Stock movement recorded.");
    await loadInventory();
  }

  const lowStockCount = parts.filter((part) => part.is_active && part.quantity_in_stock <= part.minimum_stock_level).length;
  const visibleParts = parts.filter((part) =>
    `${part.part_name} ${part.sku || ""} ${part.brand || ""} ${part.category?.name || ""} ${part.supplier?.name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111] p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Inventory</h2>
          <p className="mt-1 text-xs text-gray-500">Track stock levels, low stock items, and parts movement.</p>
        </div>
        <button type="button" onClick={startAdd} className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white">
          <Plus size={14} className="mr-1 inline" /> Add Part
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-gray-500">Total Parts</p><p className="mt-2 text-2xl font-black">{parts.length}</p></div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-gray-500">Low Stock</p><p className="mt-2 text-2xl font-black text-amber-400">{lowStockCount}</p></div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-gray-500">Active</p><p className="mt-2 text-2xl font-black text-emerald-400">{parts.filter((part) => part.is_active).length}</p></div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-gray-500">Stock Units</p><p className="mt-2 text-2xl font-black">{parts.reduce((sum, part) => sum + part.quantity_in_stock, 0)}</p></div>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-white/10 bg-[#080808] px-3">
        <Search size={15} className="text-gray-600" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory..." className="w-full bg-transparent px-1 py-3 text-sm outline-none" />
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">{error}</p>}
      {message && <p className="mb-4 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-400">{message}</p>}

      <div className="grid gap-3">
        {visibleParts.map((part) => {
          const lowStock = part.quantity_in_stock <= part.minimum_stock_level;
          return (
            <div key={part.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-950/40 text-red-400">
                    <Boxes size={18} />
                  </div>
                  <div>
                    <p className="font-bold">{part.part_name}</p>
                    <p className="text-xs text-gray-500">{part.sku || "No SKU"} · {part.category?.name || "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setMovementPart(part)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-400">
                    <PackageCheck size={12} className="mr-1 inline" /> Stock
                  </button>
                  <button type="button" onClick={() => startEdit(part)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-400">
                    <Pencil size={12} className="mr-1 inline" /> Edit
                  </button>
                  <button type="button" onClick={() => togglePart(part)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-400">
                    {part.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <span>Stock: <strong className="text-white">{part.quantity_in_stock}</strong> {part.unit || "pcs"}</span>
                <span>Min: {part.minimum_stock_level}</span>
                <span>Brand: {part.brand || "—"}</span>
                <span>Supplier: {part.supplier?.name || "—"}</span>
                <span>Sell: {part.selling_price ? `LKR ${Number(part.selling_price).toLocaleString()}` : "—"}</span>
                {lowStock && <span className="rounded-full bg-amber-950/40 px-2 py-1 font-bold text-amber-400">Low Stock</span>}
              </div>
            </div>
          );
        })}

        {visibleParts.length === 0 && <p className="py-10 text-center text-xs text-gray-500">No inventory parts found.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#111] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-black">{editing ? "Edit Part" : "Add Part"}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 p-2 text-gray-400"><X size={18} /></button>
            </div>

            <form onSubmit={savePart} className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-gray-400 sm:col-span-2">
                Part Name
                <input required value={form.part_name} onChange={(event) => setForm((current) => ({ ...current, part_name: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Part Number / SKU
                <input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Category
                <select value={form.category_id} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white">
                  <option value="">No category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Brand
                <input value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Supplier
                <select value={form.supplier_id} onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white">
                  <option value="">No supplier</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Purchase Price
                <input type="number" step="0.01" value={form.purchase_price} onChange={(event) => setForm((current) => ({ ...current, purchase_price: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Selling Price
                <input type="number" step="0.01" value={form.selling_price} onChange={(event) => setForm((current) => ({ ...current, selling_price: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Quantity In Stock
                <input type="number" value={form.quantity_in_stock} onChange={(event) => setForm((current) => ({ ...current, quantity_in_stock: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Minimum Stock Level
                <input type="number" value={form.minimum_stock_level} onChange={(event) => setForm((current) => ({ ...current, minimum_stock_level: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Unit
                <input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400 sm:col-span-2">
                Notes
                <textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="flex items-center gap-2 pt-7 text-xs font-bold text-gray-400">
                <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /> Active
              </label>

              <div className="flex justify-end gap-3 sm:col-span-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 px-4 py-3 text-xs font-bold text-gray-400">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-red-600 px-5 py-3 text-xs font-bold text-white disabled:opacity-60">
                  {saving ? "Saving..." : editing ? "Update Part" : "Save Part"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {movementPart && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-black">Stock Movement · {movementPart.part_name}</h3>
              <button type="button" onClick={() => setMovementPart(null)} className="rounded-lg border border-white/10 p-2 text-gray-400"><X size={18} /></button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-gray-400">
                Quantity
                <input type="number" min="1" value={movementForm.quantity} onChange={(event) => setMovementForm((current) => ({ ...current, quantity: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
              <label className="block text-xs font-bold text-gray-400">
                Movement Type
                <select value={movementForm.type} onChange={(event) => setMovementForm((current) => ({ ...current, type: event.target.value as StockMovementType }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white">
                  {movementTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-gray-400 sm:col-span-2">
                Notes
                <textarea rows={3} value={movementForm.notes} onChange={(event) => setMovementForm((current) => ({ ...current, notes: event.target.value }))} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white" />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setMovementPart(null)} className="rounded-lg border border-white/10 px-4 py-3 text-xs font-bold text-gray-400">Cancel</button>
              <button type="button" onClick={() => void commitMovement()} className="rounded-lg bg-red-600 px-5 py-3 text-xs font-bold text-white">Save Stock Update</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
