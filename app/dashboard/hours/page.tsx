"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export default function ParlourHoursPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [activeDays, setActiveDays] = useState<Record<string, boolean>>({});
  const [dayTimes, setDayTimes] = useState<Record<string, [string, string]>>({});
  const [cutoffHours, setCutoffHours] = useState(24);

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
      .select("parlour_id, parlour:parlour_id(weekly_hours, cancellation_cutoff_hours)")
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!staffRow) {
      setLoading(false);
      return;
    }

    setParlourId(staffRow.parlour_id);

    const hours =
      (staffRow.parlour as unknown as { weekly_hours: Record<string, [string, string]>; cancellation_cutoff_hours: number } | null)?.weekly_hours ?? {};
    setCutoffHours(
      (staffRow.parlour as unknown as { cancellation_cutoff_hours: number } | null)?.cancellation_cutoff_hours ?? 24
    );

    const active: Record<string, boolean> = {};
    const times: Record<string, [string, string]> = {};
    for (const [day, range] of Object.entries(hours)) {
      active[day] = true;
      times[day] = range;
    }
    setActiveDays(active);
    setDayTimes(times);
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

  async function handleSave() {
    if (!parlourId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const weeklyHours: Record<string, [string, string]> = {};
    for (const day of DAYS) {
      if (activeDays[day.key]) {
        weeklyHours[day.key] = dayTimes[day.key] ?? ["09:00", "17:00"];
      }
    }

    const { error: updateError } = await supabase
      .from("parlour")
      .update({ weekly_hours: weeklyHours, cancellation_cutoff_hours: cutoffHours })
      .eq("id", parlourId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
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
      <div className="max-w-md mx-auto">
        <a href="/dashboard" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to dashboard
        </a>
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-1">Opening hours</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">
          Used for services where clients don&apos;t pick a specific groomer — booking against your overall capacity
          instead.
        </p>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>
        )}
        {saved && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">Saved.</div>
        )}

        <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-3">
          {DAYS.map((day) => (
            <div key={day.key} className="flex items-center gap-3">
              <label className="flex items-center gap-2 w-28">
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

          <div className="border-t border-black/10 pt-4 mt-2">
            <label className="block text-sm font-medium text-[#14261F] mb-1">
              Cancellation cutoff
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={cutoffHours}
                onChange={(e) => setCutoffHours(parseInt(e.target.value) || 0)}
                className="w-20 rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
              />
              <span className="text-sm text-[#14261F]/60">hours before a booking</span>
            </div>
            <p className="text-xs text-[#14261F]/50 mt-1">
              Clients can cancel or reschedule themselves up until this many hours before their
              appointment. After that, they&apos;ll need to contact you directly.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50 mt-4"
          >
            {saving ? "Saving…" : "Save hours"}
          </button>
        </div>
      </div>
    </div>
  );
}
