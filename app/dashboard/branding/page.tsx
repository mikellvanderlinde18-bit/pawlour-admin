"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const PRESET_COLORS = [
  { name: "Forest", primary: "#14261F", accent: "#D98F5F" },
  { name: "Ocean", primary: "#1B3A4B", accent: "#5EA8C7" },
  { name: "Berry", primary: "#3A1B2E", accent: "#E88BA8" },
  { name: "Sunset", primary: "#4A2511", accent: "#F2A65A" },
  { name: "Plum", primary: "#2E1A3A", accent: "#B98BE8" },
];

export default function BrandingPage() {
  const supabase = createClient();

  const [parlourId, setParlourId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#14261F");
  const [accentColor, setAccentColor] = useState("#D98F5F");

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
      .select("parlour_id, parlour:parlour_id(logo_url, brand_primary_color, brand_accent_color)")
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!staffRow) {
      setLoading(false);
      return;
    }

    setParlourId(staffRow.parlour_id);
    const p = staffRow.parlour as unknown as {
      logo_url: string | null;
      brand_primary_color: string;
      brand_accent_color: string;
    } | null;

    if (p) {
      setLogoUrl(p.logo_url ?? "");
      setPrimaryColor(p.brand_primary_color ?? "#14261F");
      setAccentColor(p.brand_accent_color ?? "#D98F5F");
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !parlourId) return;

    setUploading(true);
    setError(null);

    const ext = file.name.split(".").pop();
    const path = `${parlourId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("parlour-logos")
      .upload(path, file, { upsert: true });

    setUploading(false);

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("parlour-logos").getPublicUrl(path);
    setLogoUrl(`${data.publicUrl}?t=${Date.now()}`);
  }

  async function handleSave() {
    if (!parlourId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: saveError } = await supabase
      .from("parlour")
      .update({
        logo_url: logoUrl || null,
        brand_primary_color: primaryColor,
        brand_accent_color: accentColor,
      })
      .eq("id", parlourId);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
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
        <h1 className="text-2xl font-semibold text-[#14261F] mt-2 mb-1">Branding</h1>
        <p className="text-sm text-[#14261F]/60 mb-8">
          Make your booking app look like your parlour, not ours.
        </p>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        {saved && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
            Saved — your client app will reflect this immediately.
          </div>
        )}

        <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-6">
          <div>
            <p className="text-sm font-semibold text-[#14261F] mb-3">Logo</p>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {uploading ? (
                  <span className="text-xs text-white/70">…</span>
                ) : logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span style={{ color: accentColor }} className="text-2xl">
                    🐾
                  </span>
                )}
              </div>
              <label className="cursor-pointer text-sm font-medium text-[#14261F] underline">
                Upload logo
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#14261F] mb-3">Brand colors</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setPrimaryColor(preset.primary);
                    setAccentColor(preset.accent);
                  }}
                  className="flex items-center gap-2 rounded-full border border-black/10 pl-1 pr-3 py-1"
                >
                  <span className="flex">
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.primary }} />
                    <span
                      className="w-4 h-4 rounded-full -ml-1.5"
                      style={{ backgroundColor: preset.accent }}
                    />
                  </span>
                  <span className="text-xs text-[#14261F]">{preset.name}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#14261F]/60 mb-1">Primary</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-black/15 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 rounded-lg border border-black/15 px-2 py-2 text-xs text-[#14261F]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14261F]/60 mb-1">Accent</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-black/15 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1 rounded-lg border border-black/15 px-2 py-2 text-xs text-[#14261F]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#14261F]/50 uppercase tracking-wide mb-2">Preview</p>
            <div className="bg-[#FAF6EF] rounded-2xl p-5 border border-black/10">
              <div
                className="w-12 h-12 rounded-2xl mx-auto mb-2 flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <span style={{ color: accentColor }}>🐾</span>
              </div>
              <button
                className="w-full rounded-full py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Confirm booking
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#14261F] text-[#FAF6EF] rounded-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save branding"}
          </button>
        </div>
      </div>
    </div>
  );
}
