"use client";

import { useEffect, useState, useCallback, use } from "react";
import { createClient } from "@/lib/supabase/client";

type Service = { id: string; name: string; duration_minutes: number };
type Slot = { slot_start: string; slot_end: string };

export default function AvailabilityPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groomerId } = use(params);
  const supabase = createClient();

  const [groomerName, setGroomerName] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroomerAndServices = useCallback(async () => {
    setLoading(true);

    const { data: groomer } = await supabase
      .from("groomer")
      .select("name, groomer_service(service:service_id(id, name, duration_minutes))")
      .eq("id", groomerId)
      .single();

    setGroomerName(groomer?.name ?? "Groomer");

    const linkedServices = (
      (groomer?.groomer_service ?? []) as unknown as { service: Service }[]
    ).map((gs) => gs.service);

    setServices(linkedServices);
    if (linkedServices.length > 0) setServiceId(linkedServices[0].id);

    setLoading(false);
  }, [supabase, groomerId]);

  useEffect(() => {
    loadGroomerAndServices();
  }, [loadGroomerAndServices]);

  const checkAvailability = useCallback(async () => {
    if (!serviceId || !date) return;
    setChecking(true);
    setError(null);

    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      setChecking(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("get_available_slots", {
      p_groomer_id: groomerId,
      p_date: date,
      p_duration_minutes: service.duration_minutes,
    });

    setChecking(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSlots(data ?? []);
  }, [supabase, groomerId, serviceId, date, services]);

  useEffect(() => {
    if (services.length > 0) checkAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, date, services.length]);

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
        <a href="/dashboard/groomers" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to groomers
        </a>
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-1">
          {groomerName}&apos;s availability
        </h1>
        <p className="text-sm text-[#14261F]/60 mb-8">
          This is exactly what a client would see when booking — calculated live from weekly
          hours, schedule exceptions, and existing bookings.
        </p>

        {services.length === 0 ? (
          <div className="bg-white border border-black/10 rounded-2xl p-6 text-sm text-[#14261F]/60">
            This groomer isn&apos;t linked to any services yet — add that on the Groomers page
            first.
          </div>
        ) : (
          <>
            <div className="bg-white border border-black/10 rounded-2xl p-6 flex gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#14261F] mb-1">Service</label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#14261F] mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">
                {error}
              </div>
            )}

            {checking ? (
              <p className="text-sm text-[#14261F]/50">Checking availability…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-[#14261F]/50 italic">
                No available slots on this date.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((slot) => (
                  <div
                    key={slot.slot_start}
                    className="bg-white border border-black/10 rounded-lg text-center py-2 text-sm text-[#14261F]"
                  >
                    {new Date(slot.slot_start).toLocaleTimeString("en-ZA", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
