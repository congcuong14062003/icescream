export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="tw-flex tw-flex-col tw-gap-4 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between">
      <div>
        {eyebrow && <div className="tw-mb-2 tw-flex tw-items-center tw-gap-2 tw-text-[11px] tw-font-extrabold tw-uppercase tw-tracking-[0.12em] tw-text-mint-600"><span className="tw-h-px tw-w-5 tw-bg-mint-500" />{eyebrow}</div>}
        <h2 className="tw-m-0 tw-text-2xl tw-font-extrabold tw-tracking-[-0.035em] tw-text-slate-950 sm:tw-text-[30px] dark:tw-text-white">{title}</h2>
        {description && <p className="tw-mb-0 tw-mt-2 tw-max-w-2xl tw-text-sm tw-leading-6 tw-text-slate-500 dark:tw-text-slate-400">{description}</p>}
      </div>
      {actions && <div className="tw-flex tw-shrink-0 tw-flex-wrap tw-gap-2">{actions}</div>}
    </div>
  );
}
