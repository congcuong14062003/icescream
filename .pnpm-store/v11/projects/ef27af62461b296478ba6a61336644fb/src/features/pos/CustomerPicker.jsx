import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, X } from "lucide-react";
import { IconButton, InputAdornment } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage } from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";

export default function CustomerPicker({ customer, onSelect }) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  const customersQuery = useQuery({
    queryKey: ["customer-search", search],
    queryFn: () => api.get("/customers", { params: { search, size: 10 } }).then((response) => response.data.data),
    enabled: open && search.trim().length >= 2,
  });

  const createCustomer = async (values) => {
    try {
      const response = await api.post("/customers", {
        ...values,
        dateOfBirth: values.dateOfBirth || null,
      });
      onSelect(response.data.data);
      setCreateOpen(false);
      setOpen(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Đã tạo và chọn khách hàng");
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  if (customer) {
    return (
      <div className="tw-flex tw-items-center tw-gap-3 tw-rounded-2xl tw-bg-mint-50 tw-p-3 dark:tw-bg-mint-700/20">
        <div className="tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-full tw-bg-mint-200 tw-font-black tw-text-mint-700">
          {customer.fullName.charAt(0)}
        </div>
        <div className="tw-min-w-0 tw-flex-1">
          <div className="tw-truncate tw-text-sm tw-font-black">{customer.fullName}</div>
          <div className="tw-text-xs tw-text-slate-500">{customer.phone} · {customer.points} điểm</div>
        </div>
        <IconButton size="small" onClick={() => onSelect(null)} aria-label="Bỏ khách hàng"><X size={17} /></IconButton>
      </div>
    );
  }

  return (
    <>
      <Button variant="outlined" fullWidth startIcon={<UserPlus size={17} />} onClick={() => setOpen(true)}>
        Chọn hoặc tạo khách hàng
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tìm khách hàng"
        actions={<Button startIcon={<UserPlus size={17} />} onClick={() => setCreateOpen(true)}>Tạo khách hàng mới</Button>}
      >
        <Input
          autoFocus
          label="Tên hoặc số điện thoại"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }}
        />
        <div className="tw-mt-4 tw-space-y-2">
          {search.trim().length < 2 ? (
            <EmptyState title="Nhập ít nhất 2 ký tự" description="Tìm nhanh theo tên hoặc số điện thoại." />
          ) : customersQuery.data?.length ? (
            customersQuery.data.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => { onSelect(item); setOpen(false); }}
                className="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-100 tw-bg-transparent tw-p-3 tw-text-left hover:tw-bg-mint-50 dark:tw-border-slate-700 dark:hover:tw-bg-mint-700/10"
              >
                <div className="tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-full tw-bg-lavender-100 tw-font-black tw-text-lavender-500">{item.fullName.charAt(0)}</div>
                <div className="tw-flex-1">
                  <strong className="tw-block tw-text-sm">{item.fullName}</strong>
                  <span className="tw-text-xs tw-text-slate-500">{item.phone} · {item.membershipLevel.name}</span>
                </div>
                <span className="tw-text-xs tw-font-bold tw-text-mint-700">{item.points} điểm</span>
              </button>
            ))
          ) : (
            <EmptyState title="Không tìm thấy khách hàng" />
          )}
        </div>
      </Modal>
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo khách hàng tại quầy"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button onClick={handleSubmit(createCustomer)} loading={isSubmitting}>Tạo và chọn</Button>
          </>
        }
      >
        <div className="tw-space-y-4 tw-pt-2">
          <Input label="Họ và tên" error={errors.fullName} {...register("fullName", { required: "Vui lòng nhập họ tên" })} />
          <Input label="Số điện thoại" error={errors.phone} {...register("phone", { required: "Vui lòng nhập số điện thoại" })} />
          <Input label="Email (không bắt buộc)" type="email" {...register("email")} />
          <Input label="Ngày sinh" type="date" InputLabelProps={{ shrink: true }} {...register("dateOfBirth")} />
          <Input label="Địa chỉ" multiline rows={2} {...register("address")} />
        </div>
      </Modal>
    </>
  );
}
