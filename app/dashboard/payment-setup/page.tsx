"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PaymentSetupPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

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

    const { data: paymentRow } = await supabase
      .from("parlour_payment")
      .select("paystack_public_key, paystack_secret_key, enabled")
      .eq("parlour_id", staffRow.parlour_id)
      .maybeSingle();

    if (paymentRow) {
      setPublicKey(paymentRow.paystack_public_key ?? "");
      setSecretKey(paymentRow.paystack_secret_key ?? "");
      setEnabled(paymentRow.enabled);
      setHasExisting(true);
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

    if (enabled && (!publicKey.trim() || !secretKey.trim())) {
      setError("Both keys are required to turn payments on.");
      return;
    }

    setSaving(true);

    const payload = {
      parlour_id: parlourId,
      paystack_public_key: publicKey.trim() || null,
      paystack_secret_key: secretKey.trim() || null,
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

  return (
    <div className="px-8 py-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-[#14261F] mb-1">Payment setup</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">
          Let clients pay in-app. Money goes straight to your own bank account — WorkInFlow never
          touches it.
        </p>

        <div className="bg-white border border-black/10 rounded-2xl p-6 mb-6">
          <p className="text-sm font-semibold text-[#14261F] mb-2">How this works</p>
          <ol className="text-sm text-[#14261F]/70 space-y-2 list-decimal list-inside">
            <li>
              Create a free account at{" "}
              <a href="https://paystack.com" target="_blank" rel="noreferrer" className="underline">
                paystack.com
              </a>{" "}
              if you don&apos;t have one — takes a few minutes, no setup or monthly fee.
            </li>
            <li>
              To go live in South Africa, Paystack will ask for CIPC registration documents (or
              sole proprietorship equivalent), a SARS tax clearance certificate, ID, and proof of
              bank account. This usually takes 1–2 business days to activate.
            </li>
            <li>
              Once activated, go to <strong>Settings → API Keys &amp; Webhooks</strong> in your
              Paystack dashboard and copy your keys in below.
            </li>
          </ol>
          <p className="text-xs text-[#14261F]/50 mt-3">
            Paystack&apos;s standard fee is roughly 2.9% + R1 per transaction (plus VAT) — this
            comes off your payout, WorkInFlow doesn&apos;t take any cut.
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
          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Public key</label>
            <input
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="pk_test_..."
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#14261F] mb-1">Secret key</label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="sk_test_..."
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-[#14261F] font-mono"
            />
            <p className="text-xs text-[#14261F]/40 mt-1">
              Kept private — only used server-side to verify and refund payments, never shown to
              clients.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
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
