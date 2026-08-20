"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type PriceRule = { id: string; attribute_type: string | null; attribute_value: string | null; price: number };
type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  active: boolean;
  requires_groomer_selection: boolean;
  concurrent_capacity: number;
  price_rule: PriceRule[];
};

export default function ServicesPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [usesAttribute, setUsesAttribute] = useState(false);
  const [attributeType, setAttributeType] = useState("size");
  const [flatPrice, setFlatPrice] = useState("");
  const [attributeRows, setAttributeRows] = useState([{ value: "", price: "" }]);
  const [requiresGroomer, setRequiresGroomer] = useState(true);
  const [capacity, setCapacity] = useState(1);
  const [saving, setSaving] = useState(false);

  const loadServices = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: staffRow } = await supabase
      .from("parlour_staff")
      .select("parlour_id")
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!staffRow) {
      setLoading(false);
      return;
    }

    setParlourId(staffRow.parlour_id);

    const { data: serviceRows, error: serviceError } = await supabase
      .from("service")
      .select(
        "id, name, description, duration_minutes, active, requires_groomer_selection, concurrent_capacity, price_rule(id, attribute_type, attribute_value, price)"
      )
      .eq("parlour_id", staffRow.parlour_id)
      .order("created_at", { ascending: true });

    if (serviceError) {
      setError(serviceError.message);
    } else {
      setServices((serviceRows ?? []) as unknown as Service[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

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

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!parlourId) {
      setError("No parlour found for this account.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a service name.");
      return;
    }

    setSaving(true);

    const { data: newService, error: serviceError } = await supabase
      .from("service")
      .insert({
        parlour_id: parlourId,
        name: name.trim(),
        duration_minutes: duration,
        requires_groomer_selection: requiresGroomer,
        concurrent_capacity: requiresGroomer ? 1 : capacity,
      })
      .select("id")
      .single();

    if (serviceError || !newService) {
      setError(serviceError?.message ?? "Could not create the service.");
      setSaving(false);
      return;
    }

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
            service_id: newService.id,
            attribute_type: attributeType,
            attribute_value: row.value.trim(),
            price: parseFloat(row.price),
          }))
      : [
          {
            service_id: newService.id,
            attribute_type: null,
            attribute_value: null,
            price: parseFloat(flatPrice || "0"),
          },
        ];

    if (rulesToInsert.length === 0) {
      setError("Add at least one price.");
      setSaving(false);
      return;
    }

    const { error: priceError } = await supabase.from("price_rule").insert(rulesToInsert);

    setSaving(false);

    if (priceError) {
      setError(priceError.message);
      return;
    }

    setName("");
    setDuration(60);
    setUsesAttribute(false);
    setFlatPrice("");
    setAttributeRows([{ value: "", price: "" }]);
    setRequiresGroomer(true);
    setCapacity(1);

    loadServices();
  }

  async function handleDeleteService(id: string) {
    await supabase.from("service").delete().eq("id", id);
    loadServices();
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
        <a href="/dashboard" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to dashboard
        </a>
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-1">Services &amp; pricing</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">
          Set up what you offer and how you price it. Clients will see these when they book.
        </p>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">{error}</div>
        )}

        <div className="space-y-3 mb-8">
          {services.length === 0 && <p className="text-sm text-[#14261F]/50 italic">No services added yet.</p>}

          {services.map((service) => (
            <div key={service.id} className="bg-white border border-black/10 rounded-2xl p-5 flex items-start justify-between">
              <div>
                <div className="font-semibold text-[#14261F]">{service.name}</div>
                <div className="text-xs text-[#14261F]/50 mb-2">
                  {service.duration_minutes} min ·{" "}
                  {service.requires_groomer_selection ? "clients choose groomer" : `capacity: ${service.concurrent_capacity} at once`}
                </div>
                <div className="flex flex-wrap gap-2">
                  {service.price_rule.map((rule) => (
                    <span key={rule.id} className="text-xs bg-[#FAF6EF] border border-black/10 rounded-full px-3 py-1 text-[#14261F]">
                      {rule.attribute_value ? `${rule.attribute_value}: ` : ""}R{Number(rule.price).toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <a href={`/dashboard/services/${service.id}`} className="text-xs text-[#14261F]/60 hover:underline">
                  Edit →
                </a>
                <button onClick={() => handleDeleteService(service.id)} className="text-xs text-red-500 hover:underline">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddService} className="bg-white border border-black/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#14261F]">Add a service</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#14261F] mb-1">Service name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
                placeholder="e.g. Full groom"
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
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
              />
            </div>
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
                groomer — you&apos;ll assign it internally.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
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
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
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
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
                  placeholder="e.g. size, coat_type, breed"
                />
              </div>

              {attributeRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateAttributeRow(i, "value", e.target.value)}
                    className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
                    placeholder="e.g. Small"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={row.price}
                    onChange={(e) => updateAttributeRow(i, "price", e.target.value)}
                    className="w-28 rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
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
            type="submit"
            disabled={saving}
            className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add service"}
          </button>
        </form>
      </div>
    </div>
  );
}
