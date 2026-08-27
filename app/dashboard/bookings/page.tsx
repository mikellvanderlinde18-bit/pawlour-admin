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
  appointment_status: string;
  groomer_notes: string | null;
  paid: boolean;
  tip_amount: number;
  payment_reference: string | null;
  refund_status: string;
  groomer_id: string | null;
  service: { name: string } | null;
  groomer: { name: string } | null;
  client: { name: string; phone: string | null } | null;
  dog: { name: string; species: string; photo_url: string | null; breed: string | null; care_flags: string[] } | null;
};

export default function BookingsListPage() {
  const supabase = createClient();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [groomers, setGroomers] = useState<Groomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

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

    let query = supabase
      .from("booking")
      .select(
        "id, starts_at, ends_at, price, status, appointment_status, groomer_notes, paid, tip_amount, payment_reference, refund_status, groomer_id, service:service_id(name), groomer:groomer_id(name), client:client_id(name, phone), dog:dog_id(name, species, photo_url, breed, care_flags)"
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

    const { data: groomerRows } = await supabase.from("groomer").select("id, name").eq("parlour_id", staffRow.parlour_id).order("name");
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

  async function handleMarkDone(id: string) {
    await supabase.from("booking").update({ status: "completed", paid: true }).eq("id", id);
    loadData();
  }

  async function handleTogglePaid(id: string, paid: boolean) {
    await supabase.from("booking").update({ paid: !paid }).eq("id", id);
    loadData();
  }

  async function handleStatusChange(id: string, status: string) {
    await supabase.from("booking").update({ appointment_status: status }).eq("id", id);
    loadData();
  }

  async function handleSaveNotes(id: string, notes: string) {
    await supabase.from("booking").update({ groomer_notes: notes }).eq("id", id);
    loadData();
  }

  async function handleRefund(booking: Booking) {
    if (!confirm(`Refund R${Number(booking.price).toFixed(2)} to this client via Paystack? This can't be undone.`)) return;

    setRefundingId(booking.id);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Session expired — please log in again.");
        return;
      }

      const res = await fetch(
        `https://vdktciebkfyjtanyzdfu.supabase.co/functions/v1/refund-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ booking_id: booking.id }),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        setError(result.error ?? "Refund failed.");
        return;
      }

      loadData();
    } catch {
      setError("Could not reach the payment service — check your connection and try again.");
    } finally {
      setRefundingId(null);
    }
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
          <a href="/dashboard/bookings/new" className="bg-[#14261F] text-[#FAF6EF] rounded-full px-4 py-2 text-sm font-semibold">
            + New booking
          </a>
        </div>

        <div className="flex gap-2 mb-6">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs rounded-full px-4 py-1.5 border capitalize ${
                filter === f ? "bg-[#14261F] text-[#FAF6EF] border-[#14261F]" : "bg-white text-[#14261F] border-black/15"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>}

        <div className="space-y-2">
          {bookings.length === 0 && <p className="text-sm text-[#14261F]/50 italic">No {filter !== "all" ? filter : ""} bookings.</p>}
          {bookings.map((b) => (
            <div key={b.id} className="bg-white border border-black/10 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-[#FAF6EF] border border-black/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {b.dog?.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.dog.photo_url} alt={b.dog.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs">{b.dog?.species === "cat" ? "🐱" : "🐾"}</span>
                      )}
                    </div>
                    <span className="font-semibold text-[#14261F] text-sm">
                      {b.service?.name ?? "Service"} — {b.dog?.name ?? "Pet"}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        b.status === "confirmed"
                          ? "bg-blue-50 text-blue-700"
                          : b.status === "completed"
                          ? "bg-green-50 text-green-700"
                          : b.status === "cancelled"
                          ? "bg-red-50 text-red-600"
                          : "bg-[#FAF6EF] text-[#14261F]/60"
                      }`}
                    >
                      {b.status}
                    </span>
                    {b.status !== "cancelled" && (
                      <button
                        onClick={() => handleTogglePaid(b.id, b.paid)}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          b.paid ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {b.paid ? "Paid" : "Unpaid"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#14261F]/50">
                    {new Date(b.starts_at).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                    {" · "}
                    {b.client?.name ?? "Client"}
                    {b.client?.phone ? ` · ${b.client.phone}` : ""}
                    {b.dog?.breed ? ` · ${b.dog.breed}` : ""}
                  </p>
                  {b.dog?.care_flags && b.dog.care_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {b.dog.care_flags.map((flag) => (
                        <span key={flag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          ⚠ {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-[#14261F]">R{Number(b.price).toFixed(2)}</p>
                  {b.tip_amount > 0 && (
                    <p className="text-[10px] text-[#14261F]/40">+R{Number(b.tip_amount).toFixed(2)} tip</p>
                  )}
                  {b.status === "confirmed" && (
                    <div className="flex flex-col items-end gap-1 mt-1">
                      <button
                        onClick={() => handleMarkDone(b.id)}
                        className="text-xs text-green-700 hover:underline font-medium"
                      >
                        Mark done &amp; collected
                      </button>
                      <button onClick={() => handleCancel(b.id)} className="text-xs text-red-500 hover:underline">
                        Cancel
                      </button>
                    </div>
                  )}
                  {b.status === "cancelled" && b.paid && b.payment_reference && b.refund_status !== "refunded" && (
                    <button
                      onClick={() => handleRefund(b)}
                      disabled={refundingId === b.id}
                      className="text-xs text-amber-700 hover:underline font-medium mt-1 disabled:opacity-50"
                    >
                      {refundingId === b.id ? "Refunding…" : "Refund via Paystack"}
                    </button>
                  )}
                  {b.refund_status === "refunded" && (
                    <p className="text-xs text-[#14261F]/40 mt-1">Refunded</p>
                  )}
                </div>
              </div>

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

              {b.status === "confirmed" && (
                <div className="mt-3 pt-3 border-t border-black/10">
                  <span className="text-xs text-[#14261F]/50 block mb-1.5">Live status (client sees this):</span>
                  <select
                    value={b.appointment_status}
                    onChange={(e) => handleStatusChange(b.id, e.target.value)}
                    className="text-xs rounded-lg border border-black/15 px-2 py-1 text-[#14261F]"
                  >
                    <option value="not_started">Not started</option>
                    <option value="checked_in">Checked in</option>
                    <option value="in_progress">In the bath / being groomed</option>
                    <option value="drying">Drying</option>
                    <option value="ready_for_pickup">Ready for pickup</option>
                    <option value="collected">Collected</option>
                  </select>
                </div>
              )}

              {(b.status === "confirmed" || b.status === "completed") && (
                <div className="mt-3 pt-3 border-t border-black/10">
                  <span className="text-xs text-[#14261F]/50 block mb-1.5">
                    Groomer notes (client sees this in their history):
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={notesDraft[b.id] ?? b.groomer_notes ?? ""}
                      onChange={(e) => setNotesDraft((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      placeholder="e.g. Found a small mat behind the ear, keep an eye on it"
                      className="flex-1 text-xs rounded-lg border border-black/15 px-2 py-1.5 text-[#14261F]"
                    />
                    <button
                      onClick={() => handleSaveNotes(b.id, notesDraft[b.id] ?? b.groomer_notes ?? "")}
                      className="text-xs bg-[#14261F] text-[#FAF6EF] rounded-lg px-3"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
