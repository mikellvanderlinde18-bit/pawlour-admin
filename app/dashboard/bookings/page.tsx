"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Groomer = { id: string; name: string };
type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  price: number;
  status: string;
  groomer_id: string | null;
  service: { name: string } | null;
  groomer: { name: string } | null;
  client: { name: string; phone: string | null } | null;
  dog: { name: string } | null;
};

export default function BookingsListPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [groomers, setGroomers] = useState<Groomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [assigningId, setAssigningId] = useState<string | null>(null);

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
      .select("parlour_id")
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!staffRow) {
      setLoading(false);
      return;
    }
    setParlourId(staffRow.parlour_id);

    let query = supabase
      .from("booking")
      .select(
        "id, starts_at, ends_at, price, status, groomer_id, service:service_id(name), groomer:groomer_id(name), client:client_id(name, phone), dog:dog_id(name)"
      )
      .eq("parlour_id", staffRow.parlour_id);

    const now = new Date().toISOString();
    if (filter === "upcoming") {
      query = query.gte("starts_at", now).order("starts_at", { ascending: true });
    } else if (filter === "past") {
      query = query.lt("starts_at", now).order("starts_at", { ascending: false });
    } else {
      query = query.order("starts_at", { ascending: false });
    }

    const { data: bookingRows, error: bookingError } = await query;

    if (bookingError) {
      setError(bookingError.message);
    } else {
      setBookings((bookingRows ?? []) as unknown as Booking[]);
    }

    const { data: groomerRows } = await supabase
      .from("groomer")
      .select("id, name")
      .eq("parlour_id", staffRow.parlour_id)
      .order("name");
    setGroomers(groomerRows ?? []);

    setLoading(false);
  }, [supabase, filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCancel(id: string) {
    if (!confirm("Cancel this booking?")) return;
    await supabase.from("booking").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", id);
    loadData();
  }

  async function handleAssignGroomer(id: string, groomerId: string) {
    setAssigningId(id);
    await supabase.from("booking").update({ groomer_id: groomerId || null }).eq("id", id);
    setAssigningId(null);
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
      <div className="max-w-3xl mx-auto">
        <a href="/dashboard" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to dashboard
        </a>
        <div className="flex items-center justify-between mt-2 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#14261F]">Bookings</h1>
            <p className="text-sm text-[#14261F]/60">All bookings for your parlour</p>
          </div>
          <a
            href="/dashboard/bookings/new"
            className="bg-[#14261F] text-[#FAF6EF] rounded-full px-4 py-2 text-sm font-semibold"
          >
            + New booking
          </a>
        </div>

        <div className="flex gap-2 mb-6">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs rounded-full px-4 py-1.5 border capitalize ${
                filter === f
                  ? "bg-[#14261F] text-[#FAF6EF] border-[#14261F]"
                  : "bg-white text-[#14261F] border-black/15"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {bookings.length === 0 && (
            <p className="text-sm text-[#14261F]/50 italic">No {filter !== "all" ? filter : ""} bookings.</p>
          )}
          {bookings.map((b) => (
            <div key={b.id} className="bg-white border border-black/10 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-[#14261F] text-sm">
                      {b.service?.name ?? "Service"} — {b.dog?.name ?? "Dog"}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        b.status === "confirmed"
                          ? "bg-green-50 text-green-700"
                          : b.status === "cancelled"
                          ? "bg-red-50 text-red-600"
                          : "bg-[#FAF6EF] text-[#14261F]/60"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#14261F]/50">
                    {new Date(b.starts_at).toLocaleString("en-ZA", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                    {" · "}
                    {b.client?.name ?? "Client"}
                    {b.client?.phone ? ` · ${b.client.phone}` : ""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-[#14261F]">R{Number(b.price).toFixed(2)}</p>
                  {b.status === "confirmed" && (
                    <button
                      onClick={() => handleCancel(b.id)}
                      className="text-xs text-red-500 hover:underline mt-1"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Groomer: show name, or let staff assign one for capacity-based bookings */}
              <div className="mt-3 pt-3 border-t border-black/10 flex items-center gap-2">
                <span className="text-xs text-[#14261F]/50">Groomer:</span>
                {b.groomer?.name ? (
                  <span className="text-xs font-medium text-[#14261F]">{b.groomer.name}</span>
                ) : (
                  <select
                    defaultValue=""
                    disabled={assigningId === b.id || b.status !== "confirmed"}
                    onChange={(e) => handleAssignGroomer(b.id, e.target.value)}
                    className="text-xs rounded-lg border border-black/15 px-2 py-1 text-[#14261F]"
                  >
                    <option value="">Unassigned — pick a groomer</option>
                    {groomers.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
