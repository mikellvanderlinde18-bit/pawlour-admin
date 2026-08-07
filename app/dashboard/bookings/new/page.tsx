"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Service = { id: string; name: string; duration_minutes: number };
type Groomer = { id: string; name: string };
type PriceRule = { id: string; attribute_type: string | null; attribute_value: string | null; price: number };
type Client = { id: string; name: string; phone: string | null };
type Dog = { id: string; name: string; size: string | null; coat_type: string | null };
type Slot = { slot_start: string; slot_end: string };

export default function NewBookingPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [priceRules, setPriceRules] = useState<PriceRule[]>([]);

  const [groomers, setGroomers] = useState<Groomer[]>([]);
  const [groomerId, setGroomerId] = useState("");

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [checkingSlots, setCheckingSlots] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [dogId, setDogId] = useState("");

  const [manualPriceRuleId, setManualPriceRuleId] = useState("");
  const [saving, setSaving] = useState(false);

  // New client / dog quick-add
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [showNewDog, setShowNewDog] = useState(false);
  const [newDogName, setNewDogName] = useState("");
  const [newDogSize, setNewDogSize] = useState("");
  const [newDogCoat, setNewDogCoat] = useState("");

  const loadInitial = useCallback(async () => {
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

    const [{ data: serviceRows }, { data: clientRows }] = await Promise.all([
      supabase
        .from("service")
        .select("id, name, duration_minutes")
        .eq("parlour_id", staffRow.parlour_id)
        .order("name"),
      supabase
        .from("client")
        .select("id, name, phone")
        .eq("parlour_id", staffRow.parlour_id)
        .order("name"),
    ]);

    setServices(serviceRows ?? []);
    setClients(clientRows ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // When service changes: load its price rules and eligible groomers
  useEffect(() => {
    if (!serviceId) {
      setPriceRules([]);
      setGroomers([]);
      return;
    }

    (async () => {
      const [{ data: rules }, { data: groomerLinks }] = await Promise.all([
        supabase.from("price_rule").select("id, attribute_type, attribute_value, price").eq("service_id", serviceId),
        supabase
          .from("groomer_service")
          .select("groomer:groomer_id(id, name)")
          .eq("service_id", serviceId),
      ]);

      setPriceRules(rules ?? []);
      setGroomers(
        ((groomerLinks ?? []) as unknown as { groomer: Groomer }[]).map((g) => g.groomer)
      );
      setGroomerId("");
      setSlots([]);
      setSelectedSlot(null);
    })();
  }, [serviceId, supabase]);

  // When client changes: load their dogs
  useEffect(() => {
    if (!clientId) {
      setDogs([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("dog")
        .select("id, name, size, coat_type")
        .eq("client_id", clientId)
        .order("name");
      setDogs(data ?? []);
      setDogId("");
    })();
  }, [clientId, supabase]);

  const checkAvailability = useCallback(async () => {
    if (!groomerId || !serviceId || !date) return;
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    setCheckingSlots(true);
    const { data, error: rpcError } = await supabase.rpc("get_available_slots", {
      p_groomer_id: groomerId,
      p_date: date,
      p_duration_minutes: service.duration_minutes,
    });
    setCheckingSlots(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSlots(data ?? []);
    setSelectedSlot(null);
  }, [supabase, groomerId, serviceId, date, services]);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Resolve price: try to auto-match dog's attribute to a price rule, else require manual pick
  const flatRule = priceRules.find((r) => !r.attribute_type);
  const attributeRules = priceRules.filter((r) => r.attribute_type);
  const selectedDog = dogs.find((d) => d.id === dogId);

  let autoMatchedRule: PriceRule | null = null;
  if (attributeRules.length > 0 && selectedDog) {
    for (const rule of attributeRules) {
      const dogValue =
        rule.attribute_type === "size"
          ? selectedDog.size
          : rule.attribute_type === "coat_type"
          ? selectedDog.coat_type
          : null;
      if (dogValue && dogValue.toLowerCase() === rule.attribute_value?.toLowerCase()) {
        autoMatchedRule = rule;
        break;
      }
    }
  }

  const resolvedRule =
    flatRule ??
    autoMatchedRule ??
    priceRules.find((r) => r.id === manualPriceRuleId) ??
    null;

  async function handleCreateClient() {
    if (!newClientName.trim() || !parlourId) return;
    const { data, error: clientError } = await supabase
      .from("client")
      .insert({ parlour_id: parlourId, name: newClientName.trim(), phone: newClientPhone.trim() || null })
      .select("id, name, phone")
      .single();
    if (clientError || !data) {
      setError(clientError?.message ?? "Could not add client.");
      return;
    }
    setClients((prev) => [...prev, data]);
    setClientId(data.id);
    setShowNewClient(false);
    setNewClientName("");
    setNewClientPhone("");
  }

  async function handleCreateDog() {
    if (!newDogName.trim() || !clientId) return;
    const { data, error: dogError } = await supabase
      .from("dog")
      .insert({
        client_id: clientId,
        name: newDogName.trim(),
        size: newDogSize.trim() || null,
        coat_type: newDogCoat.trim() || null,
      })
      .select("id, name, size, coat_type")
      .single();
    if (dogError || !data) {
      setError(dogError?.message ?? "Could not add dog.");
      return;
    }
    setDogs((prev) => [...prev, data]);
    setDogId(data.id);
    setShowNewDog(false);
    setNewDogName("");
    setNewDogSize("");
    setNewDogCoat("");
  }

  async function handleConfirmBooking() {
    setError(null);

    if (!parlourId || !clientId || !dogId || !groomerId || !serviceId || !selectedSlot || !resolvedRule) {
      setError("Please complete every step before confirming.");
      return;
    }

    setSaving(true);

    const { error: bookingError } = await supabase.from("booking").insert({
      parlour_id: parlourId,
      client_id: clientId,
      dog_id: dogId,
      groomer_id: groomerId,
      service_id: serviceId,
      starts_at: selectedSlot.slot_start,
      ends_at: selectedSlot.slot_end,
      price: resolvedRule.price,
      status: "confirmed",
    });

    setSaving(false);

    if (bookingError) {
      setError(bookingError.message);
      return;
    }

    setSuccess("Booking confirmed!");
    setSelectedSlot(null);
    checkAvailability();
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
        <a href="/dashboard/bookings" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to bookings
        </a>
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-1">New booking</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">
          For phone or walk-in bookings — this uses the same availability engine clients will see.
        </p>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-6">
            {success}
          </div>
        )}

        <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-5">
          {/* Service */}
          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
            >
              <option value="">Select a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_minutes} min)
                </option>
              ))}
            </select>
          </div>

          {/* Groomer */}
          {serviceId && (
            <div>
              <label className="block text-sm font-medium text-[#14261F] mb-1">Groomer</label>
              {groomers.length === 0 ? (
                <p className="text-xs text-[#14261F]/50 italic">
                  No groomer is linked to this service yet.
                </p>
              ) : (
                <select
                  value={groomerId}
                  onChange={(e) => setGroomerId(e.target.value)}
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                >
                  <option value="">Select a groomer…</option>
                  {groomers.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Date + slots */}
          {groomerId && (
            <div>
              <label className="block text-sm font-medium text-[#14261F] mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] mb-3"
              />
              {checkingSlots ? (
                <p className="text-xs text-[#14261F]/50">Checking availability…</p>
              ) : slots.length === 0 ? (
                <p className="text-xs text-[#14261F]/50 italic">No slots available this date.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <button
                      type="button"
                      key={slot.slot_start}
                      onClick={() => setSelectedSlot(slot)}
                      className={`text-xs rounded-lg py-2 border ${
                        selectedSlot?.slot_start === slot.slot_start
                          ? "bg-[#14261F] text-[#FAF6EF] border-[#14261F]"
                          : "bg-white text-[#14261F] border-black/15"
                      }`}
                    >
                      {new Date(slot.slot_start).toLocaleTimeString("en-ZA", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Client */}
          {selectedSlot && (
            <div>
              <label className="block text-sm font-medium text-[#14261F] mb-1">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] mb-2"
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {!showNewClient ? (
                <button
                  type="button"
                  onClick={() => setShowNewClient(true)}
                  className="text-xs text-[#14261F]/60 underline"
                >
                  + New client
                </button>
              ) : (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Name"
                    className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                  />
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="Phone"
                    className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                  />
                  <button
                    type="button"
                    onClick={handleCreateClient}
                    className="text-xs bg-[#14261F] text-[#FAF6EF] rounded-lg px-3"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Dog */}
          {clientId && (
            <div>
              <label className="block text-sm font-medium text-[#14261F] mb-1">Dog</label>
              <select
                value={dogId}
                onChange={(e) => setDogId(e.target.value)}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] mb-2"
              >
                <option value="">Select a dog…</option>
                {dogs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {!showNewDog ? (
                <button
                  type="button"
                  onClick={() => setShowNewDog(true)}
                  className="text-xs text-[#14261F]/60 underline"
                >
                  + New dog
                </button>
              ) : (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <input
                    type="text"
                    value={newDogName}
                    onChange={(e) => setNewDogName(e.target.value)}
                    placeholder="Name"
                    className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                  />
                  <input
                    type="text"
                    value={newDogSize}
                    onChange={(e) => setNewDogSize(e.target.value)}
                    placeholder="Size (e.g. Small)"
                    className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                  />
                  <input
                    type="text"
                    value={newDogCoat}
                    onChange={(e) => setNewDogCoat(e.target.value)}
                    placeholder="Coat type"
                    className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                  />
                  <button
                    type="button"
                    onClick={handleCreateDog}
                    className="text-xs bg-[#14261F] text-[#FAF6EF] rounded-lg px-3"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Price resolution */}
          {dogId && priceRules.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#14261F] mb-1">Price</label>
              {resolvedRule ? (
                <p className="text-sm text-[#14261F]">
                  R{Number(resolvedRule.price).toFixed(2)}
                  {resolvedRule.attribute_value ? ` (${resolvedRule.attribute_value})` : ""}
                </p>
              ) : (
                <div>
                  <p className="text-xs text-[#14261F]/50 italic mb-2">
                    Couldn&apos;t auto-match this dog to a price — pick manually.
                  </p>
                  <select
                    value={manualPriceRuleId}
                    onChange={(e) => setManualPriceRuleId(e.target.value)}
                    className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                  >
                    <option value="">Select a price…</option>
                    {attributeRules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.attribute_value}: R{Number(r.price).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {resolvedRule && dogId && (
            <button
              type="button"
              onClick={handleConfirmBooking}
              disabled={saving}
              className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Confirming…" : `Confirm booking — R${Number(resolvedRule.price).toFixed(2)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
