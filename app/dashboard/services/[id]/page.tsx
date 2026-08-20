"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PriceRule = { id: string; attribute_type: string | null; attribute_value: string | null; price: number };

export default function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [requiresGroomer, setRequiresGroomer] = useState(true);
  const [capacity, setCapacity] = useState(1);
  const [active, setActive] = useState(true);

  const [usesAttribute, setUsesAttribute] = useState(false);
  const [attributeType, setAttributeType] = useState("size");
  const [flatPrice, setFlatPrice] = useState("");
  const [attributeRows, setAttributeRows] = useState<{ id?: string; value: string; price: string }[]>([
    { value: "", price: "" },
  ]);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: service, error: loadError } = await supabase
      .from("service")
      .select("name, duration_minutes, requires_groomer_selection, concurrent_capacity, active, price_rule(id, attribute_type, attribute_value, price)")
      .eq("id", id)
      .single();

    if (loadError || !service) {
      setError(loadError?.message ?? "Could not load this service.");
      setLoading(false);
      return;
    }

    setName(service.name);
    setDuration(service.duration_minutes);
    setRequiresGroomer(service.requires_groomer_selection);
    setCapacity(service.concurrent_capacity);
    setActive(service.active);

    const rules = (service.price_rule ?? []) as PriceRule[];
    const flat = rules.find((r) => !r.attribute_type);
    const attrs = rules.filter((r) => r.attribute_type);

    if (flat) {
      setUsesAttribute(false);
      setFlatPrice(String(flat.price));
    } else if (attrs.length > 0) {
      setUsesAttribute(true);
      setAttributeType(attrs[0].attribute_type ?? "size");
      setAttributeRows(attrs.map((r) => ({ id: r.id, value: r.attribute_value ?? "", price: String(r.price) })));
    }

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    load();
  }, [load]);

  function addAttributeRow() {
    setAttributeRows([...attributeRows, { value: "", price: "" }]);
  }
  function updateAttributeRow(index: number, field: "value" | "price", value: string) {
    const next = [...attributeRows];
    next[index] = { ...next[index], [field]: value };
    setAttributeRows(next);
  }
  function removeAttributeRow(index: number) {
    setAttributeRows(attributeRows.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError("Please enter a service name.");
      return;
    }
    setSaving(true);

    const { error: updateError } = await supabase
      .from("service")
      .update({
        name: name.trim(),
        duration_minutes: duration,
        requires_groomer_selection: requiresGroomer,
        concurrent_capacity: requiresGroomer ? 1 : capacity,
        active,
      })
      .eq("id", id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    // Replace price rules: delete existing, insert current set (simplest
    // consistent approach — avoids diffing add/edit/remove separately)
    await supabase.from("price_rule").delete().eq("service_id", id);

    type PriceRuleInsert = {
      service_id: string;
      attribute_type: string | null;
      attribute_value: string | null;
      price: number;
    };

    const rulesToInsert: PriceRuleInsert[] = usesAttribute
      ? attributeRows
          .filter((row) => row.value.trim() && row.price.trim())
          .map((row) => ({
            service_id: id,
            attribute_type: attributeType,
            attribute_value: row.value.trim(),
            price: parseFloat(row.price),
          }))
      : [{ service_id: id, attribute_type: null, attribute_value: null, price: parseFloat(flatPrice || "0") }];

    const { error: priceError } = await supabase.from("price_rule").insert(rulesToInsert);

    setSaving(false);

    if (priceError) {
      setError(priceError.message);
      return;
    }

    setSaved(true);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("service").delete().eq("id", id);
    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.push("/dashboard/services");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] px-6 py-10 flex items-center justify-center">
        <p className="text-sm text-[#14261F]/50">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EF] px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <a href="/dashboard/services" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to services
        </a>
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-8">Edit {name}</h1>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">{error}</div>
        )}
        {saved && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-6">
            Saved.
          </div>
        )}

        <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#14261F] mb-1">Service name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#14261F] mb-1">Duration (minutes)</label>
              <input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-black/20"
            />
            <label htmlFor="active" className="text-sm text-[#14261F]">
              Active — visible to clients when booking
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requiresGroomer"
              checked={requiresGroomer}
              onChange={(e) => setRequiresGroomer(e.target.checked)}
              className="rounded border-black/20"
            />
            <label htmlFor="requiresGroomer" className="text-sm text-[#14261F]">
              Clients choose which groomer does this service
            </label>
          </div>
          {!requiresGroomer && (
            <div>
              <label className="block text-sm font-medium text-[#14261F] mb-1">How many can you do at once?</label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                className="w-32 rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
              />
              <p className="text-xs text-[#14261F]/50 mt-1">
                e.g. 2 wash stations means you can do 2 washes at the same time. Clients won&apos;t pick a specific
                groomer — you&apos;ll assign it internally on the bookings page.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-black/10">
            <input
              type="checkbox"
              id="usesAttribute"
              checked={usesAttribute}
              onChange={(e) => setUsesAttribute(e.target.checked)}
              className="rounded border-black/20"
            />
            <label htmlFor="usesAttribute" className="text-sm text-[#14261F]">
              Price varies by dog attribute (e.g. size, coat type)
            </label>
          </div>

          {!usesAttribute ? (
            <div>
              <label className="block text-sm font-medium text-[#14261F] mb-1">Price (R)</label>
              <input
                type="number"
                step="0.01"
                value={flatPrice}
                onChange={(e) => setFlatPrice(e.target.value)}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                placeholder="e.g. 450"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#14261F] mb-1">Attribute name</label>
                <input
                  type="text"
                  value={attributeType}
                  onChange={(e) => setAttributeType(e.target.value)}
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                  placeholder="e.g. size, coat_type, breed"
                />
              </div>

              {attributeRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateAttributeRow(i, "value", e.target.value)}
                    className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                    placeholder="e.g. Small"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={row.price}
                    onChange={(e) => updateAttributeRow(i, "price", e.target.value)}
                    className="w-28 rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                    placeholder="R"
                  />
                  {attributeRows.length > 1 && (
                    <button type="button" onClick={() => removeAttributeRow(i)} className="text-xs text-red-500">
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button type="button" onClick={addAttributeRow} className="text-xs text-[#14261F]/60 underline">
                + Add another value
              </button>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full text-red-500 text-xs underline disabled:opacity-40"
          >
            {deleting ? "Removing…" : "Remove this service"}
          </button>
        </div>
      </div>
    </div>
  );
}
