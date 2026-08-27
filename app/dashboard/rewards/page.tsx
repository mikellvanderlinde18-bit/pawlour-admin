"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIER_FEATURES, type Tier } from "@/lib/tierFeatures";
import UpgradeGate from "@/components/UpgradeGate";

type RewardRule = {
  id: string;
  trigger_type: string;
  threshold: number;
  reward_type: string;
  reward_value: number | null;
  active: boolean;
};

export default function RewardsPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>("starter");
  const [existingRule, setExistingRule] = useState<RewardRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [triggerType, setTriggerType] = useState<"visit_count" | "spend_total">("visit_count");
  const [threshold, setThreshold] = useState(10);
  const [rewardType, setRewardType] = useState<"free_service" | "percent_discount" | "fixed_discount">("free_service");
  const [rewardValue, setRewardValue] = useState<number | "">("");

  const loadData = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: staffRow } = await supabase.from("parlour_staff").select("parlour_id, parlour:parlour_id(tier)").eq("auth_user_id", user.id).limit(1).maybeSingle();

    if (!staffRow) {
      setLoading(false);
      return;
    }
    setParlourId(staffRow.parlour_id);
    setTier(((staffRow.parlour as unknown as { tier: Tier } | null)?.tier) ?? "starter");

    const { data: ruleRow } = await supabase
      .from("reward_rule")
      .select("id, trigger_type, threshold, reward_type, reward_value, active")
      .eq("parlour_id", staffRow.parlour_id)
      .maybeSingle();

    if (ruleRow) {
      setExistingRule(ruleRow);
      setEnabled(ruleRow.active);
      setTriggerType(ruleRow.trigger_type as "visit_count" | "spend_total");
      setThreshold(Number(ruleRow.threshold));
      setRewardType(ruleRow.reward_type as typeof rewardType);
      setRewardValue(ruleRow.reward_value ? Number(ruleRow.reward_value) : "");
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave() {
    if (!parlourId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload = {
      parlour_id: parlourId,
      trigger_type: triggerType,
      threshold,
      reward_type: rewardType,
      reward_value: rewardType === "free_service" ? null : rewardValue || null,
      active: enabled,
    };

    const { error: saveError } = existingRule
      ? await supabase.from("reward_rule").update(payload).eq("id", existingRule.id)
      : await supabase.from("reward_rule").insert(payload);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    setSaved(true);
    loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] px-6 py-10 flex items-center justify-center">
        <p className="text-sm text-[#14261F]/50">Loading…</p>
      </div>
    );
  }

  if (!TIER_FEATURES[tier].rewards) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] px-6 py-10 flex items-center justify-center">
        <UpgradeGate feature="Rewards" currentTier={tier} requiredTier="growth" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EF] px-6 py-10">
      <div className="max-w-md mx-auto">
        <a href="/dashboard" className="text-xs text-[#14261F]/50 hover:underline">
          ← Back to dashboard
        </a>
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-1">Rewards programme</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">Reward loyal clients automatically — no punch cards, tracked for every booking.</p>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>}
        {saved && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">Saved.</div>}

        <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#14261F]">Enable rewards</p>
              <p className="text-xs text-[#14261F]/50">Turn this off any time — client progress is kept.</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${enabled ? "bg-[#14261F]" : "bg-black/15"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Based on</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTriggerType("visit_count")}
                className={`flex-1 text-xs rounded-lg py-2 border ${triggerType === "visit_count" ? "bg-[#14261F] text-[#FAF6EF] border-[#14261F]" : "border-black/15 text-[#14261F]"}`}
              >
                Number of visits
              </button>
              <button
                onClick={() => setTriggerType("spend_total")}
                className={`flex-1 text-xs rounded-lg py-2 border ${triggerType === "spend_total" ? "bg-[#14261F] text-[#FAF6EF] border-[#14261F]" : "border-black/15 text-[#14261F]"}`}
              >
                Amount spent (R)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">
              {triggerType === "visit_count" ? "Every this many visits" : "Every this much spent (R)"}
            </label>
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Reward</label>
            <select value={rewardType} onChange={(e) => setRewardType(e.target.value as typeof rewardType)} className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] mb-2">
              <option value="free_service">Free service</option>
              <option value="percent_discount">Percentage discount</option>
              <option value="fixed_discount">Fixed amount off (R)</option>
            </select>
            {rewardType !== "free_service" && (
              <input
                type="number"
                min={1}
                value={rewardValue}
                onChange={(e) => setRewardValue(e.target.value ? parseFloat(e.target.value) : "")}
                placeholder={rewardType === "percent_discount" ? "e.g. 20 (for 20%)" : "e.g. 100"}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F]"
              />
            )}
          </div>

          <p className="text-xs text-[#14261F]/50 bg-[#FAF6EF] rounded-lg px-3 py-2">
            e.g. &quot;Every {threshold} {triggerType === "visit_count" ? "visits" : "Rand spent"}, the client gets a{" "}
            {rewardType === "free_service" ? "free service" : rewardType === "percent_discount" ? `${rewardValue || "X"}% discount` : `R${rewardValue || "X"} off`}.&quot;
          </p>

          <button onClick={handleSave} disabled={saving} className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Save rewards programme"}
          </button>
        </div>
      </div>
    </div>
  );
}
