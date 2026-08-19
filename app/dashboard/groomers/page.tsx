"use client";

import { useEffect, useState, useCallback } from "react";
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
type Groomer = {
  id: string;
  name: string;
  weekly_hours: Record<string, [string, string]>;
  active: boolean;
  groomer_service: { service_id: string }[];
};

export default function GroomersPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [groomers, setGroomers] = useState<Groomer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seatInfo, setSeatInfo] = useState<{ used: number; limit: number } | null>(null);

  const [name, setName] = useState("");
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>({});
  const [dayTimes, setDayTimes] = useState<Record<string, [string, string]>>({});
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  const seatLimits: Record<string, number> = { starter: 1, growth: 3, pro: 10 };

  const loadData = useCallback(async () => {
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
      .select("parlour_id, parlour:parlour_id(tier)")
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!staffRow) {
      setLoading(false);
      return;
    }

    setParlourId(staffRow.parlour_id);
    const tier = (staffRow.parlour as unknown as { tier: string } | null)?.tier ?? "starter";

    const [{ data: groomerRows, error: groomerError }, { data: serviceRows }, { count }] = await Promise.all([
      supabase
        .from("groomer")
        .select("id, name, weekly_hours, active, groomer_service(service_id)")
        .eq("parlour_id", staffRow.parlour_id)
        .order("created_at", { ascending: true }),
      supabase.from("service").select("id, name").eq("parlour_id", staffRow.parlour_id).order("name", { ascending: true }),
      supabase.from("parlour_staff").select("id", { count: "exact", head: true }).eq("parlour_id", staffRow.parlour_id),
    ]);

    if (groomerError) {
      setError(groomerError.message);
    } else {
      setGroomers((groomerRows ?? []) as unknown as Groomer[]);
    }

    setServices(serviceRows ?? []);
    setSeatInfo({ used: count ?? 0, limit: seatLimits[tier] ?? 1 });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  async function handleAddGroomer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!parlourId) {
      setError("No parlour found for this account.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a groomer's name.");
      return;
    }

    setSaving(true);

    const weeklyHours: Record<string, [string, string]> = {};
    for (const day of DAYS) {
      if (activeDays[day.key]) {
        weeklyHours[day.key] = dayTimes[day.key] ?? ["09:00", "17:00"];
      }
    }

    const { data: newGroomer, error: groomerError } = await supabase
      .from("groomer")
      .insert({ parlour_id: parlourId, name: name.trim(), weekly_hours: weeklyHours })
      .select("id")
      .single();

    if (groomerError || !newGroomer) {
      setError(groomerError?.message ?? "Could not add groomer.");
      setSaving(false);
      return;
    }

    if (selectedServices.size > 0) {
      const links = Array.from(selectedServices).map((serviceId) => ({
        groomer_id: newGroomer.id,
        service_id: serviceId,
      }));
      const { error: linkError } = await supabase.from("groomer_service").insert(links);
      if (linkError) {
        setError(linkError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setName("");
    setActiveDays({});
    setDayTimes({});
    setSelectedServices(new Set());
    loadData();
  }

  async function handleDeleteGroomer(id: string) {
    await supabase.from("groomer").delete().eq("id", id);
    loadData();
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
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-1">Groomers</h1>
        <p className="text-sm text-[#14261F]/60 mb-1">
          Add your team, set their hours, and link them to the services they perform.
        </p>
        {seatInfo && (
          <p className="text-xs text-[#14261F]/50 mb-8">
            Staff logins used: {seatInfo.used} / {seatInfo.limit} — groomers themselves aren&apos;t limited, only who
            can log in to this dashboard.
          </p>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">{error}</div>
        )}

        <div className="space-y-3 mb-8">
          {groomers.length === 0 && <p className="text-sm text-[#14261F]/50 italic">No groomers added yet.</p>}

          {groomers.map((groomer) => (
            <div key={groomer.id} className="bg-white border border-black/10 rounded-2xl p-5 flex items-start justify-between">
              <div>
                <div className="font-semibold text-[#14261F]">{groomer.name}</div>
                <div className="text-xs text-[#14261F]/50 mt-1 mb-2">
                  {Object.keys(groomer.weekly_hours || {}).length > 0
                    ? Object.entries(groomer.weekly_hours)
                        .map(([day, times]) => `${day} ${times[0]}–${times[1]}`)
                        .join(" · ")
                    : "No hours set"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {groomer.groomer_service.length === 0 && (
                    <span className="text-xs text-[#14261F]/40 italic">No services linked</span>
                  )}
                  {groomer.groomer_service.map((gs) => {
                    const svc = services.find((s) => s.id === gs.service_id);
                    return svc ? (
                      <span key={gs.service_id} className="text-xs bg-[#FAF6EF] border border-black/10 rounded-full px-3 py-1 text-[#14261F]">
                        {svc.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => handleDeleteGroomer(groomer.id)} className="text-xs text-red-500 hover:underline">
                  Remove
                </button>
                <a href={`/dashboard/groomers/${groomer.id}/schedule`} className="text-xs text-[#14261F]/60 hover:underline">
                  Schedule exceptions →
                </a>
                <a href={`/dashboard/groomers/${groomer.id}/availability`} className="text-xs text-[#14261F]/60 hover:underline">
                  Preview availability →
                </a>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddGroomer} className="bg-white border border-black/10 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-[#14261F]">Add a groomer</h2>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
              placeholder="e.g. Nomsa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-2">Working days &amp; hours</label>
            <div className="space-y-2">
              {DAYS.map((day) => (
                <div key={day.key} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-16">
                    <input
                      type="checkbox"
                      checked={!!activeDays[day.key]}
                      onChange={() => toggleDay(day.key)}
                      className="rounded border-black/20"
                    />
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
              <p className="text-xs text-[#14261F]/50 italic">Add services first on the Services &amp; pricing page.</p>
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
            type="submit"
            disabled={saving}
            className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add groomer"}
          </button>
        </form>
      </div>
    </div>
  );
}
