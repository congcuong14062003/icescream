import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from "@mui/material";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = "sm",
  fullScreen = false,
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth} fullScreen={fullScreen}>
      <DialogTitle className="tw-flex tw-items-center tw-justify-between tw-gap-4 tw-border-b tw-border-slate-100 !tw-px-6 !tw-py-4 dark:tw-border-slate-800">
        <span className="tw-text-lg tw-font-extrabold tw-tracking-[-0.02em]">{title}</span>
        <IconButton onClick={onClose} aria-label="Đóng" size="small" className="!tw-bg-slate-100 dark:!tw-bg-slate-800">
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent className="!tw-p-6">{children}</DialogContent>
      {actions && <DialogActions className="tw-border-t tw-border-slate-100 !tw-px-6 !tw-py-4 dark:tw-border-slate-800">{actions}</DialogActions>}
    </Dialog>
  );
}
