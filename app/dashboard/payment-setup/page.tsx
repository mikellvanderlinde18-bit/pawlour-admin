"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIER_FEATURES, type Tier } from "@/lib/tierFeatures";
import UpgradeGate from "@/components/UpgradeGate";

type Provider = "paystack" | "yoco" | "payfast";

export default function PaymentSetupPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>("starter");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  const [provider, setProvider] = useState<Provider>("paystack");
  const [enabled, setEnabled] = useState(false);

  // Paystack / Yoco share this shape
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");

  // PayFast has its own shape
  const [merchantId, setMerchantId] = useState("");
  const [merchantKey, setMerchantKey] = useState("");
  const [passphrase, setPassphrase] = useState("");

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
    setTier(((staffRow.parlour as unknown as { tier: Tier } | null)?.tier) ?? "starter");

    const { data: paymentRow } = await supabase
      .from("parlour_payment")
      .select("provider, credentials, enabled")
      .eq("parlour_id", staffRow.parlour_id)
      .maybeSingle();

    if (paymentRow) {
      setHasExisting(true);
      setEnabled(paymentRow.enabled);
      if (paymentRow.provider) setProvider(paymentRow.provider as Provider);

      const creds = paymentRow.credentials ?? {};
      setPublicKey(creds.public_key ?? "");
      setSecretKey(creds.secret_key ?? "");
      setMerchantId(creds.merchant_id ?? "");
      setMerchantKey(creds.merchant_key ?? "");
      setPassphrase(creds.passphrase ?? "");
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave() {
    if (!parlourId) return;
    setError(null);
    setSaved(false);

    let credentials: Record<string, string> = {};
    if (provider === "paystack" || provider === "yoco") {
      if (enabled && (!publicKey.trim() || !secretKey.trim())) {
        setError("Both keys are required to turn payments on.");
        return;
      }
      credentials = { public_key: publicKey.trim(), secret_key: secretKey.trim() };
    } else if (provider === "payfast") {
      if (enabled && (!merchantId.trim() || !merchantKey.trim())) {
        setError("Merchant ID and Merchant Key are required to turn payments on.");
        return;
      }
      credentials = {
        merchant_id: merchantId.trim(),
        merchant_key: merchantKey.trim(),
        passphrase: passphrase.trim(),
      };
    }

    setSaving(true);

    const payload = {
      parlour_id: parlourId,
      provider,
      credentials,
      enabled,
      updated_at: new Date().toISOString(),
    };

    const { error: saveError } = hasExisting
      ? await supabase.from("parlour_payment").update(payload).eq("parlour_id", parlourId)
      : await supabase.from("parlour_payment").insert(payload);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    setHasExisting(true);
    setSaved(true);
  }

  if (loading) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-[#14261F]/50">Loading…</p>
      </div>
    );
  }

  if (!TIER_FEATURES[tier].inAppPayments) {
    return (
      <div className="px-8 py-8 flex justify-center">
        <UpgradeGate feature="In-app client payments" currentTier={tier} requiredTier="growth" />
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-[#14261F] mb-1">Payment setup</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">
          Let clients pay in-app. Pick whichever provider you already use — money goes straight
          to your own account, WorkInFlow never touches it.
        </p>

        <div className="bg-white border border-black/10 rounded-2xl p-6 mb-6">
          <label className="block text-sm font-medium text-[#14261F] mb-2">Provider</label>
          <div className="flex gap-2">
            {(["paystack", "yoco", "payfast"] as Provider[]).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`flex-1 text-sm rounded-lg py-2.5 border capitalize ${
                  provider === p
                    ? "bg-[#14261F] text-[#FAF6EF] border-[#14261F]"
                    : "bg-white text-[#14261F] border-black/15"
                }`}
              >
                {p === "paystack" ? "Paystack" : p === "yoco" ? "Yoco" : "PayFast"}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#14261F]/50 mt-3">
            Already have a Yoco card machine in your parlour? Pick Yoco — online and in-person
            share the same account. Already run on debit orders or want the widest local payment
            options (Instant EFT, SnapScan)? PayFast is a strong fit. Want the simplest developer
            setup? Paystack.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</div>
        )}
        {saved && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
            Saved.
          </div>
        )}

        <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-4">
          {(provider === "paystack" || provider === "yoco") && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#14261F] mb-1">Public key</label>
                <input
                  type="text"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder={provider === "paystack" ? "pk_test_..." : "pk_test_..."}
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#14261F] mb-1">Secret key</label>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder={provider === "paystack" ? "sk_test_..." : "sk_test_..."}
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] font-mono"
                />
                <p className="text-xs text-[#14261F]/40 mt-1">
                  Kept private — only used server-side, never shown to clients.
                </p>
              </div>
            </>
          )}

          {provider === "payfast" && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#14261F] mb-1">Merchant ID</label>
                <input
                  type="text"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#14261F] mb-1">Merchant Key</label>
                <input
                  type="password"
                  value={merchantKey}
                  onChange={(e) => setMerchantKey(e.target.value)}
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#14261F] mb-1">Passphrase (optional)</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] font-mono"
                />
                <p className="text-xs text-[#14261F]/40 mt-1">
                  Only needed if you set a security passphrase in your PayFast settings.
                </p>
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-black/10">
            <div>
              <p className="text-sm font-semibold text-[#14261F]">Let clients pay in-app</p>
              <p className="text-xs text-[#14261F]/50">
                Clients will see a &quot;Pay now&quot; option when booking. They can still choose
                to pay in person instead.
              </p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${enabled ? "bg-[#14261F]" : "bg-black/15"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save payment settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
