import { IceCreamBowl } from "lucide-react";

export default function EmptyState({ title = "Chưa có dữ liệu", description, action }) {
  return (
    <div className="tw-flex tw-min-h-56 tw-flex-col tw-items-center tw-justify-center tw-rounded-2xl tw-border tw-border-dashed tw-border-slate-200 tw-bg-slate-50/40 tw-p-8 tw-text-center dark:tw-border-slate-700 dark:tw-bg-slate-800/20">
      <div className="tw-mb-4 tw-rounded-2xl tw-bg-mint-100 tw-p-4 tw-text-mint-700 dark:tw-bg-mint-700/20 dark:tw-text-mint-300">
        <IceCreamBowl size={32} />
      </div>
      <h3 className="tw-m-0 tw-text-lg tw-font-extrabold">{title}</h3>
      {description && (
        <p className="tw-mb-5 tw-mt-2 tw-max-w-sm tw-text-sm tw-text-slate-500 dark:tw-text-slate-400">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
