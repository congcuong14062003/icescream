import Button from "./Button";
import Modal from "./Modal";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Xác nhận thao tác",
  message,
  confirmText = "Xác nhận",
  loading = false,
  color = "error",
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose}>
            Quay lại
          </Button>
          <Button color={color} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="tw-m-0 tw-text-slate-600 dark:tw-text-slate-300">{message}</p>
    </Modal>
  );
}

