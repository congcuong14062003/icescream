import { CirclePlus, IceCreamBowl, Sparkles } from "lucide-react";
import { formatMoney } from "../../utils/format";

export default function ProductCard({ product, onClick }) {
  const activePrices = product.variants
    ?.filter((variant) => variant.isActive)
    .map((variant) => variant.price) || [];
  const startingPrice = activePrices.length ? Math.min(...activePrices) : product.price;
  const unavailable = product.status !== "ACTIVE";
  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={() => onClick(product)}
      className="tw-group tw-relative tw-flex tw-min-h-52 tw-flex-col tw-overflow-hidden tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-2.5 tw-text-left tw-shadow-[0_1px_2px_rgba(15,23,42,0.03)] tw-transition-all tw-duration-200 hover:-tw-translate-y-0.5 hover:tw-border-mint-300 hover:tw-shadow-panel disabled:tw-cursor-not-allowed disabled:tw-opacity-60 dark:tw-border-slate-700 dark:tw-bg-slate-900"
    >
      {product.isFeatured && (
        <span className="tw-absolute tw-left-4 tw-top-4 tw-z-10 tw-flex tw-items-center tw-gap-1 tw-rounded-md tw-bg-slate-950/80 tw-px-2 tw-py-1 tw-text-[10px] tw-font-bold tw-uppercase tw-tracking-wide tw-text-white tw-backdrop-blur">
          <Sparkles size={11} /> Best seller
        </span>
      )}
      <div className="tw-relative tw-flex tw-h-28 tw-w-full tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-xl tw-bg-[#edf5f2] dark:tw-bg-slate-800">
        <div className="tw-absolute tw-inset-x-0 tw-bottom-0 tw-h-1 tw-bg-mint-500/70" />
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="tw-h-full tw-w-full tw-object-cover tw-transition tw-duration-300 group-hover:tw-scale-105" />
        ) : (
          <div className="tw-flex tw-h-16 tw-w-16 tw-items-center tw-justify-center tw-rounded-full tw-bg-white tw-text-mint-600 tw-shadow-sm dark:tw-bg-slate-700">
            <IceCreamBowl size={31} />
          </div>
        )}
      </div>
      <div className="tw-flex tw-flex-1 tw-flex-col tw-px-1.5 tw-pb-1 tw-pt-3">
        <span className="tw-text-[10px] tw-font-bold tw-uppercase tw-tracking-[0.08em] tw-text-slate-400">{product.category?.name}</span>
        <strong className="tw-mt-1 tw-line-clamp-2 tw-text-[15px] tw-font-extrabold tw-leading-5 tw-text-slate-900 dark:tw-text-white">{product.name}</strong>
        <div className="tw-mt-auto tw-flex tw-items-center tw-justify-between tw-gap-2 tw-pt-3">
          <span className="tw-text-[15px] tw-font-extrabold tw-text-mint-700 dark:tw-text-mint-300">
            {formatMoney(startingPrice)}
          </span>
          <CirclePlus size={21} className="tw-text-slate-300 tw-transition group-hover:tw-text-mint-600" />
        </div>
      </div>
    </button>
  );
}
