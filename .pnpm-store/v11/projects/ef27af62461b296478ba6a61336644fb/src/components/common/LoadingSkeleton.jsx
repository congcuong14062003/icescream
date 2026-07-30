import { Skeleton } from "@mui/material";

export default function LoadingSkeleton({ rows = 5, cards = false }) {
  return (
    <div className={cards ? "tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2 xl:tw-grid-cols-4" : "tw-space-y-3"}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          variant="rounded"
          height={cards ? 160 : 58}
          animation="wave"
          sx={{ borderRadius: 3 }}
        />
      ))}
    </div>
  );
}

