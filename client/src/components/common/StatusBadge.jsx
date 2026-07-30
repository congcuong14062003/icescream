const styles = {
  ACTIVE: "tw-bg-emerald-100 tw-text-emerald-700 dark:tw-bg-emerald-900/40 dark:tw-text-emerald-300",
  AVAILABLE: "tw-bg-emerald-100 tw-text-emerald-700 dark:tw-bg-emerald-900/40 dark:tw-text-emerald-300",
  OPEN: "tw-bg-emerald-100 tw-text-emerald-700 dark:tw-bg-emerald-900/40 dark:tw-text-emerald-300",
  COMPLETED: "tw-bg-emerald-100 tw-text-emerald-700 dark:tw-bg-emerald-900/40 dark:tw-text-emerald-300",
  PAID: "tw-bg-emerald-100 tw-text-emerald-700 dark:tw-bg-emerald-900/40 dark:tw-text-emerald-300",
  PENDING: "tw-bg-amber-100 tw-text-amber-700 dark:tw-bg-amber-900/40 dark:tw-text-amber-300",
  MAKING: "tw-bg-blue-100 tw-text-blue-700 dark:tw-bg-blue-900/40 dark:tw-text-blue-300",
  READY: "tw-bg-violet-100 tw-text-violet-700 dark:tw-bg-violet-900/40 dark:tw-text-violet-300",
  DRAFT: "tw-bg-slate-100 tw-text-slate-700 dark:tw-bg-slate-700 dark:tw-text-slate-200",
  INACTIVE: "tw-bg-slate-100 tw-text-slate-600 dark:tw-bg-slate-700 dark:tw-text-slate-300",
  CLOSED: "tw-bg-slate-100 tw-text-slate-600 dark:tw-bg-slate-700 dark:tw-text-slate-300",
  CANCELLED: "tw-bg-rose-100 tw-text-rose-700 dark:tw-bg-rose-900/40 dark:tw-text-rose-300",
  LOCKED: "tw-bg-rose-100 tw-text-rose-700 dark:tw-bg-rose-900/40 dark:tw-text-rose-300",
  OUT_OF_STOCK: "tw-bg-rose-100 tw-text-rose-700 dark:tw-bg-rose-900/40 dark:tw-text-rose-300",
  REFUNDED: "tw-bg-rose-100 tw-text-rose-700 dark:tw-bg-rose-900/40 dark:tw-text-rose-300",
};

export default function StatusBadge({ status, label }) {
  return (
    <span
      className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-lg tw-px-2.5 tw-py-1 tw-text-[11px] tw-font-bold ${
        styles[status] || styles.DRAFT
      }`}
    >
      <span className="tw-h-1.5 tw-w-1.5 tw-rounded-full tw-bg-current tw-opacity-70" />
      {label || status}
    </span>
  );
}
