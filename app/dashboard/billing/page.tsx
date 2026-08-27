"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const PLAN_PRICES: Record<string, number> = { starter: 399, growth: 799, pro: 1499 };
const PLAN_LABELS: Record<string, string> = { starter: "Starter", growth: "Growth", pro: "Pro" };

type Subscription = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

type ParlourInfo = {
  name: string;
  status: string;
  trial_ends_at: string;
};

export default function BillingPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [parlour, setParlour] = useState<ParlourInfo | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>("starter");
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      .select("parlour_id, parlour:parlour_id(name, status, trial_ends_at)")
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!staffRow) {
      setLoading(false);
      return;
    }

    setParlourId(staffRow.parlour_id);
    setParlour(staffRow.parlour as unknown as ParlourInfo);

    const { data: subRow } = await supabase
      .from("subscription")
      .select("plan, status, current_period_end")
      .eq("parlour_id", staffRow.parlour_id)
      .maybeSingle();

    setSubscription(subRow);
    if (subRow?.plan) setSelectedPlan(subRow.plan);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCheckout() {
    if (!parlourId) return;
    setError(null);
    setCheckingOut(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Session expired — please log in again.");
        setCheckingOut(false);
        return;
      }

      const res = await fetch(
        `https://vdktciebkfyjtanyzdfu.supabase.co/functions/v1/subscribe-parlour`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ parlour_id: parlourId, plan: selectedPlan }),
        }
      );

      const result = await res.json();
      setCheckingOut(false);

      if (!res.ok) {
        setError(result.error ?? "Could not start checkout.");
        return;
      }

      window.location.href = result.authorization_url;
    } catch {
      setError("Could not reach the payment service — check your connection and try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-[#14261F]/50">Loading…</p>
      </div>
    );
  }

  if (!parlour || !subscription) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-[#14261F]/60">No billing information found for this account.</p>
      </div>
    );
  }

  const daysLeft = parlour.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(parlour.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const statusBadge = {
    trialing: { label: "Free trial", color: "bg-blue-50 text-blue-700" },
    active: { label: "Active", color: "bg-green-50 text-green-700" },
    past_due: { label: "Payment overdue", color: "bg-amber-50 text-amber-700" },
    paused: { label: "Paused — payment needed", color: "bg-red-50 text-red-600" },
    cancelled: { label: "Cancelled", color: "bg-[#FAF6EF] text-[#14261F]/60" },
  }[subscription.status] ?? { label: subscription.status, color: "bg-[#FAF6EF] text-[#14261F]/60" };

  return (
    <div className="px-8 py-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-[#14261F] mb-1">Billing</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">Your WorkInFlow subscription for {parlour.name}.</p>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">{error}</div>
        )}

        <div className="bg-white border border-black/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-[#14261F]/50 mb-1">Current plan</p>
              <p className="text-xl font-semibold text-[#14261F]">{PLAN_LABELS[subscription.plan]}</p>
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>

          <div className="border-t border-black/10 pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#14261F]/50">Price</span>
              <span className="text-[#14261F] font-medium">R{PLAN_PRICES[subscription.plan]}/month</span>
            </div>
            {subscription.status === "trialing" && (
              <div className="flex justify-between">
                <span className="text-[#14261F]/50">Trial ends</span>
                <span className="text-[#14261F] font-medium">
                  {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Ended"}
                </span>
              </div>
            )}
          </div>

          {subscription.status === "paused" && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              Your booking page is currently paused because your trial ended without a payment
              method on file. Your data is safe — subscribe below to reactivate instantly.
            </div>
          )}

          {(subscription.status === "trialing" || subscription.status === "paused" || subscription.status === "past_due" || subscription.status === "cancelled") && (
            <div className="mt-5">
              <label className="block text-sm font-medium text-[#14261F] mb-2">Choose your plan</label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {Object.entries(PLAN_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPlan(key)}
                    className={`text-xs rounded-lg py-2.5 border ${
                      selectedPlan === key
                        ? "bg-[#14261F] text-[#FAF6EF] border-[#14261F]"
                        : "bg-white text-[#14261F] border-black/15"
                    }`}
                  >
                    {label}
                    <br />
                    <span className="opacity-70">R{PLAN_PRICES[key]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={checkingOut}
            className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold mt-2 disabled:opacity-50"
          >
            {checkingOut
              ? "Redirecting to Paystack…"
              : subscription.status === "active"
              ? "Update payment method"
              : `Subscribe to ${PLAN_LABELS[selectedPlan]} — R${PLAN_PRICES[selectedPlan]}/month`}
          </button>
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-6">
          <p className="text-xs font-semibold text-[#14261F]/50 uppercase tracking-wide mb-3">
            All plans
          </p>
          <div className="space-y-2">
            {Object.entries(PLAN_LABELS).map(([key, label]) => (
              <div
                key={key}
                className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                  subscription.plan === key ? "bg-[#FAF6EF]" : ""
                }`}
              >
                <span className="text-sm text-[#14261F]">{label}</span>
                <span className="text-sm text-[#14261F]/60">R{PLAN_PRICES[key]}/month</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
