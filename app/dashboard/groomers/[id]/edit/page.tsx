"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

type Service = { id: string; name: string };

export default function EditGroomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>({});
  const [dayTimes, setDayTimes] = useState<Record<string, [string, string]>>({});
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);

    const { data: groomer, error: loadError } = await supabase
      .from("groomer")
      .select("name, weekly_hours, active, parlour_id, groomer_service(service_id)")
      .eq("id", id)
      .single();

    if (loadError || !groomer) {
      setError(loadError?.message ?? "Could not load this groomer.");
      setLoading(false);
      return;
    }

    setName(groomer.name);
    setActive(groomer.active);

    const hours = (groomer.weekly_hours ?? {}) as Record<string, [string, string]>;
    const activeD: Record<string, boolean> = {};
    for (const [day, range] of Object.entries(hours)) {
      activeD[day] = true;
    }
    setActiveDays(activeD);
    setDayTimes(hours);

    const linked = (groomer.groomer_service ?? []) as { service_id: string }[];
    setSelectedServices(new Set(linked.map((l) => l.service_id)));

    const { data: serviceRows } = await supabase
      .from("service")
      .select("id, name")
      .eq("parlour_id", groomer.parlour_id)
      .order("name");
    setServices(serviceRows ?? []);

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleDay(dayKey: string) {
    setActiveDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
    if (!dayTimes[dayKey]) {
      setDayTimes((prev) => ({ ...prev, [dayKey]: ["09:00", "17:00"] }));
    }
  }
  function updateDayTime(dayKey: string, index: 0 | 1, value: string) {
    setDayTimes((prev) => {
      const current = prev[dayKey] ?? ["09:00", "17:00"];
      const next: [string, string] = [...current] as [string, string];
      next[index] = value;
      return { ...prev, [dayKey]: next };
    });
  }
  function toggleService(serviceId: string) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }
    setSaving(true);

    const weeklyHours: Record<string, [string, string]> = {};
    for (const day of DAYS) {
      if (activeDays[day.key]) {
        weeklyHours[day.key] = dayTimes[day.key] ?? ["09:00", "17:00"];
      }
    }

    const { error: updateError } = await supabase
      .from("groomer")
      .update({ name: name.trim(), weekly_hours: weeklyHours, active })
      .eq("id", id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    // Replace linked services: delete existing, insert current selection
    await supabase.from("groomer_service").delete().eq("groomer_id", id);

    if (selectedServices.size > 0) {
      const links = Array.from(selectedServices).map((serviceId) => ({
        groomer_id: id,
        service_id: serviceId,
      }));
      const { error: linkError } = await supabase.from("groomer_service").insert(links);
      if (linkError) {
        setSaving(false);
        setError(linkError.message);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
  }

  async function handleDelete() {
    if (!confirm(`Remove ${name}? This can't be undone.`)) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("groomer").delete().eq("id", id);
    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.push("/dashboard/groomers");
  }

  if (loading) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-[#14261F]/50">Loading…</p>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="max-w-2xl">
        <a href="/dashboard/groomers" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to groomers
        </a>
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-8">Edit {name}</h1>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">{error}</div>
        )}
        {saved && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-6">Saved.</div>
        )}

        <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
            />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-black/20" />
            <label htmlFor="active" className="text-sm text-[#14261F]">
              Active — can be booked
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-2">Working days &amp; hours</label>
            <div className="space-y-2">
              {DAYS.map((day) => (
                <div key={day.key} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-16">
                    <input type="checkbox" checked={!!activeDays[day.key]} onChange={() => toggleDay(day.key)} className="rounded border-black/20" />
                    <span className="text-sm text-[#14261F]">{day.label}</span>
                  </label>
                  {activeDays[day.key] && (
                    <>
                      <input
                        type="time"
                        value={dayTimes[day.key]?.[0] ?? "09:00"}
                        onChange={(e) => updateDayTime(day.key, 0, e.target.value)}
                        className="rounded-lg border border-black/15 px-2 py-1 text-xs text-[#14261F]"
                      />
                      <span className="text-xs text-[#14261F]/40">to</span>
                      <input
                        type="time"
                        value={dayTimes[day.key]?.[1] ?? "17:00"}
                        onChange={(e) => updateDayTime(day.key, 1, e.target.value)}
                        className="rounded-lg border border-black/15 px-2 py-1 text-xs text-[#14261F]"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-2">Services they perform</label>
            {services.length === 0 ? (
              <p className="text-xs text-[#14261F]/50 italic">No services set up yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <button
                    type="button"
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                      selectedServices.has(service.id)
                        ? "bg-[#14261F] text-[#FAF6EF] border-[#14261F]"
                        : "bg-white text-[#14261F] border-black/15"
                    }`}
                  >
                    {service.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>

          <button onClick={handleDelete} disabled={deleting} className="w-full text-red-500 text-xs underline disabled:opacity-40">
            {deleting ? "Removing…" : "Remove this groomer"}
          </button>
        </div>
      </div>
    </div>
  );
}
