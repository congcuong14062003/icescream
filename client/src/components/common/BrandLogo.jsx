import { IceCreamBowl } from "lucide-react";

export default function BrandLogo({ compact = false, light = false }) {
  return (
    <div className="tw-flex tw-items-center tw-gap-3">
      <div className={`tw-relative tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-xl tw-text-white ${
        light ? "tw-bg-white/15 tw-ring-1 tw-ring-white/20" : "tw-bg-mint-600 tw-shadow-[0_8px_18px_rgba(22,129,110,0.24)]"
      }`}>
        <IceCreamBowl size={23} strokeWidth={2.3} />
        <span className="tw-absolute -tw-right-0.5 -tw-top-0.5 tw-h-2.5 tw-w-2.5 tw-rounded-full tw-border-2 tw-border-white tw-bg-amber-400" />
      </div>
      {!compact && (
        <div>
          <div className={`tw-text-[17px] tw-font-extrabold tw-leading-tight tw-tracking-[-0.03em] ${light ? "tw-text-white" : "tw-text-slate-900 dark:tw-text-white"}`}>
            IceCream
          </div>
          <div className={`tw-mt-0.5 tw-text-[9px] tw-font-extrabold tw-uppercase tw-tracking-[0.2em] ${
            light ? "tw-text-mint-200" : "tw-text-mint-600 dark:tw-text-mint-300"
          }`}>
            Retail POS
          </div>
        </div>
      )}
    </div>
  );
}
