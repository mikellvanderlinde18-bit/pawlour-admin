"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type BookingRow = {
  price: number;
  status: string;
  starts_at: string;
  service: { name: string } | null;
  groomer: { name: string } | null;
};

export default function ReportsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [clientCount, setClientCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: staffRow } = await supabase.from("parlour_staff").select("parlour_id").eq("auth_user_id", user.id).limit(1).maybeSingle();

    if (!staffRow) {
      setLoading(false);
      return;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: bookingRows }, { count }] = await Promise.all([
      supabase
        .from("booking")
        .select("price, status, starts_at, service:service_id(name), groomer:groomer_id(name)")
        .eq("parlour_id", staffRow.parlour_id)
        .gte("starts_at", thirtyDaysAgo),
      supabase.from("client").select("id", { count: "exact", head: true }).eq("parlour_id", staffRow.parlour_id),
    ]);

    setBookings((bookingRows ?? []) as unknown as BookingRow[]);
    setClientCount(count ?? 0);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] px-6 py-10 flex items-center justify-center">
        <p className="text-sm text-[#14261F]/50">Loading…</p>
      </div>
    );
  }

  const confirmed = bookings.filter((b) => b.status === "confirmed" || b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const revenue = confirmed.reduce((sum, b) => sum + Number(b.price), 0);

  const serviceCounts: Record<string, number> = {};
  confirmed.forEach((b) => {
    const name = b.service?.name ?? "Unknown";
    serviceCounts[name] = (serviceCounts[name] ?? 0) + 1;
  });
  const topServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const groomerCounts: Record<string, number> = {};
  confirmed.forEach((b) => {
    const name = b.groomer?.name ?? "Unassigned";
    groomerCounts[name] = (groomerCounts[name] ?? 0) + 1;
  });
  const topGroomers = Object.entries(groomerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const cancelRate = bookings.length > 0 ? Math.round((cancelled.length / bookings.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#FAF6EF] px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <a href="/dashboard" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to dashboard
        </a>
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-1">Reports</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">Last 30 days</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white border border-black/10 rounded-2xl p-5">
            <p className="text-xs text-[#14261F]/50 mb-1">Revenue</p>
            <p className="text-2xl font-semibold text-[#14261F]">R{revenue.toFixed(0)}</p>
          </div>
          <div className="bg-white border border-black/10 rounded-2xl p-5">
            <p className="text-xs text-[#14261F]/50 mb-1">Bookings</p>
            <p className="text-2xl font-semibold text-[#14261F]">{confirmed.length}</p>
          </div>
          <div className="bg-white border border-black/10 rounded-2xl p-5">
            <p className="text-xs text-[#14261F]/50 mb-1">Cancellation rate</p>
            <p className="text-2xl font-semibold text-[#14261F]">{cancelRate}%</p>
          </div>
          <div className="bg-white border border-black/10 rounded-2xl p-5">
            <p className="text-xs text-[#14261F]/50 mb-1">Total clients</p>
            <p className="text-2xl font-semibold text-[#14261F]">{clientCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-black/10 rounded-2xl p-5">
            <p className="text-xs font-semibold text-[#14261F]/50 uppercase tracking-wide mb-3">Popular services</p>
            {topServices.length === 0 ? (
              <p className="text-xs text-[#14261F]/40 italic">No data yet</p>
            ) : (
              <div className="space-y-2">
                {topServices.map(([name, count]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="text-[#14261F]">{name}</span>
                    <span className="text-[#14261F]/50">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white border border-black/10 rounded-2xl p-5">
            <p className="text-xs font-semibold text-[#14261F]/50 uppercase tracking-wide mb-3">Busiest groomers</p>
            {topGroomers.length === 0 ? (
              <p className="text-xs text-[#14261F]/40 italic">No data yet</p>
            ) : (
              <div className="space-y-2">
                {topGroomers.map(([name, count]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="text-[#14261F]">{name}</span>
                    <span className="text-[#14261F]/50">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
