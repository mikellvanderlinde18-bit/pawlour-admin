import { TIER_LABELS, type Tier } from "@/lib/tierFeatures";

export default function UpgradeGate({
  feature,
  currentTier,
  requiredTier = "growth",
}: {
  feature: string;
  currentTier: Tier;
  requiredTier?: Tier;
}) {
  return (
    <div className="bg-white border border-black/10 rounded-2xl p-8 text-center max-w-md">
      <div className="w-12 h-12 rounded-full bg-[#FAF6EF] flex items-center justify-center mx-auto mb-4">
        <span className="text-xl">🔒</span>
      </div>
      <p className="text-sm font-semibold text-[#14261F] mb-1">
        {feature} is a {TIER_LABELS[requiredTier]} feature
      </p>
      <p className="text-sm text-[#14261F]/60 mb-5">
        You&apos;re currently on {TIER_LABELS[currentTier]}. Upgrade to unlock {feature.toLowerCase()}
        {" "}for your parlour.
      </p>
      <a
        href="/dashboard/billing"
        className="inline-block bg-[#14261F] text-[#FAF6EF] rounded-full px-5 py-2.5 text-sm font-semibold"
      >
        View plans
      </a>
    </div>
  );
}
