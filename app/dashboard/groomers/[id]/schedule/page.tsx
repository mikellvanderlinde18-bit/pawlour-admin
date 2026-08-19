"use client";

import { useEffect, useState, useCallback, use } from "react";
import { createClient } from "@/lib/supabase/client";

type Override = {
  id: string;
  date: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

export default function GroomerSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groomerId } = use(params);
  const supabase = createClient();

  const [groomerName, setGroomerName] = useState<string>("");
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState("");
  const [type, setType] = useState<"add" | "remove">("add");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: groomer } = await supabase.from("groomer").select("name").eq("id", groomerId).single();
    setGroomerName(groomer?.name ?? "Groomer");

    const { data: overrideRows, error: overrideError } = await supabase
      .from("groomer_schedule_override")
      .select("id, date, is_available, start_time, end_time, reason")
      .eq("groomer_id", groomerId)
      .order("date", { ascending: true });

    if (overrideError) {
      setError(overrideError.message);
    } else {
      setOverrides(overrideRows ?? []);
    }

    setLoading(false);
  }, [supabase, groomerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddOverride(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError("Please choose a date.");
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase.from("groomer_schedule_override").insert({
      groomer_id: groomerId,
      date,
      is_available: type === "add",
      start_time: type === "add" ? startTime : null,
      end_time: type === "add" ? endTime : null,
      reason: reason.trim() || null,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setDate("");
    setReason("");
    loadData();
  }

  async function handleDelete(id: string) {
    await supabase.from("groomer_schedule_override").delete().eq("id", id);
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
        <a href="/dashboard/groomers" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to groomers
        </a>
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-1">{groomerName}&apos;s schedule exceptions</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">
          Add one-off shifts or block out days on top of their weekly hours — sick days, extra Saturdays, or fully
          casual scheduling with no fixed pattern at all.
        </p>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">{error}</div>
        )}

        <div className="space-y-2 mb-8">
          {overrides.length === 0 && <p className="text-sm text-[#14261F]/50 italic">No exceptions added yet.</p>}
          {overrides.map((o) => (
            <div key={o.id} className="bg-white border border-black/10 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium text-[#14261F]">
                  {new Date(o.date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                </span>{" "}
                {o.is_available ? (
                  <span className="text-[#14261F]/70">
                    extra shift, {o.start_time?.slice(0, 5)}–{o.end_time?.slice(0, 5)}
                  </span>
                ) : (
                  <span className="text-[#14261F]/70">unavailable</span>
                )}
                {o.reason && <span className="text-[#14261F]/40"> · {o.reason}</span>}
              </div>
              <button onClick={() => handleDelete(o.id)} className="text-xs text-red-500 hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddOverride} className="bg-white border border-black/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#14261F]">Add an exception</h2>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("add")}
              className={`flex-1 text-sm rounded-lg py-2 border ${type === "add" ? "bg-[#14261F] text-[#FAF6EF] border-[#14261F]" : "bg-white text-[#14261F] border-black/15"}`}
            >
              Add extra shift
            </button>
            <button
              type="button"
              onClick={() => setType("remove")}
              className={`flex-1 text-sm rounded-lg py-2 border ${type === "remove" ? "bg-[#14261F] text-[#FAF6EF] border-[#14261F]" : "bg-white text-[#14261F] border-black/15"}`}
            >
              Block a day
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
            />
          </div>

          {type === "add" && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#14261F] mb-1">From</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#14261F] mb-1">To</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14261F]/20 text-[#14261F]"
              placeholder="e.g. Sick, covering for Nomsa"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add exception"}
          </button>
        </form>
      </div>
    </div>
  );
}
