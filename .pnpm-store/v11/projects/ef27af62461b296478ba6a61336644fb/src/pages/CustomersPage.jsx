import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Eye, Plus, Search, Star } from "lucide-react";
import { IconButton, InputAdornment } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import Input from "../components/common/Input";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import { formatDate, formatMoney } from "../utils/format";
import { useAuth } from "../store/AuthContext";

function CustomerForm({ open, customer, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  useEffect(() => {
    reset({
      fullName: customer?.fullName || "",
      phone: customer?.phone || "",
      email: customer?.email || "",
      dateOfBirth: customer?.dateOfBirth?.slice(0, 10) || "",
      address: customer?.address || "",
    });
  }, [customer, open, reset]);
  const submit = async (values) => {
    try {
      const payload = { ...values, dateOfBirth: values.dateOfBirth || null };
      if (customer) await api.put(`/customers/${customer.id}`, payload);
      else await api.post("/customers", payload);
      toast.success(customer ? "Đã cập nhật khách hàng" : "Đã tạo khách hàng");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? "Cập nhật khách hàng" : "Thêm khách hàng"}
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose}>Hủy</Button>
          <Button loading={isSubmitting} onClick={handleSubmit(submit)}>Lưu khách hàng</Button>
        </>
      }
    >
      <div className="tw-space-y-4 tw-pt-2">
        <Input label="Họ và tên" error={errors.fullName} {...register("fullName", { required: "Vui lòng nhập họ tên" })} />
        <Input label="Số điện thoại" error={errors.phone} {...register("phone", { required: "Vui lòng nhập số điện thoại" })} />
        <Input label="Email" type="email" {...register("email")} />
        <Input label="Ngày sinh" type="date" InputLabelProps={{ shrink: true }} {...register("dateOfBirth")} />
        <Input label="Địa chỉ" multiline rows={2} {...register("address")} />
      </div>
    </Modal>
  );
}

export default function CustomersPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("customers.manage");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const customersQuery = useQuery({
    queryKey: ["customers", search],
    queryFn: () => api.get("/customers", { params: { search, size: 100 } }).then((response) => response.data.data),
  });
  const detailQuery = useQuery({
    queryKey: ["customer", selectedId],
    queryFn: () => api.get(`/customers/${selectedId}`).then((response) => response.data.data),
    enabled: Boolean(selectedId),
  });
  const columns = [
    { key: "fullName", label: "Khách hàng", render: (value, row) => <div className="tw-flex tw-items-center tw-gap-3"><div className="tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-full tw-bg-lavender-100 tw-font-black tw-text-lavender-500">{value.charAt(0)}</div><div><strong className="tw-block">{value}</strong><span className="tw-text-xs tw-text-slate-400">{row.code}</span></div></div> },
    { key: "phone", label: "Liên hệ", render: (value, row) => <div><span className="tw-block">{value}</span><span className="tw-text-xs tw-text-slate-400">{row.email || "Chưa có email"}</span></div> },
    { key: "membershipLevel", label: "Hạng", render: (value) => <span className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-bg-amber-50 tw-px-2.5 tw-py-1 tw-text-xs tw-font-bold tw-text-amber-700 dark:tw-bg-amber-900/20"><Star size={13} /> {value.name}</span> },
    { key: "totalSpending", label: "Tổng chi tiêu", align: "right", render: (value) => formatMoney(value) },
    { key: "points", label: "Điểm", align: "right", render: (value) => <strong className="tw-text-mint-700">{value.toLocaleString("vi-VN")}</strong> },
    { key: "actions", label: "", align: "right", render: (_, row) => <div className="tw-whitespace-nowrap"><IconButton onClick={() => setSelectedId(row.id)}><Eye size={17} /></IconButton>{canManage && <IconButton onClick={() => { setEditing(row); setFormOpen(true); }}><Edit3 size={17} /></IconButton>}</div> },
  ];
  const detail = detailQuery.data;
  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Thành viên & tích điểm"
        title="Khách hàng"
        description="Điểm, hạng thành viên và tổng chi tiêu được cập nhật tự động khi đơn hoàn thành."
        actions={canManage && <Button startIcon={<Plus size={18} />} onClick={() => { setEditing(null); setFormOpen(true); }}>Thêm khách hàng</Button>}
      />
      <div className="tw-max-w-xl tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <Input placeholder="Tìm theo tên, mã, số điện thoại..." value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }} />
      </div>
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <DataTable columns={columns} rows={customersQuery.data || []} loading={customersQuery.isLoading} />
      </div>
      <CustomerForm open={formOpen} customer={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
      <Modal open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title="Hồ sơ khách hàng" maxWidth="md">
        {detailQuery.isLoading ? <LoadingSkeleton rows={5} /> : detail && (
          <div className="tw-space-y-6">
            <div className="tw-grid tw-gap-3 sm:tw-grid-cols-4">
              <div className="tw-rounded-2xl tw-bg-mint-50 tw-p-4 dark:tw-bg-mint-700/20"><span className="tw-text-xs tw-text-slate-500">Hạng</span><strong className="tw-mt-1 tw-block">{detail.membershipLevel.name}</strong></div>
              <div className="tw-rounded-2xl tw-bg-blush-50 tw-p-4 dark:tw-bg-blush-500/10"><span className="tw-text-xs tw-text-slate-500">Điểm</span><strong className="tw-mt-1 tw-block">{detail.points}</strong></div>
              <div className="tw-rounded-2xl tw-bg-lavender-50 tw-p-4 dark:tw-bg-lavender-500/10"><span className="tw-text-xs tw-text-slate-500">Số đơn</span><strong className="tw-mt-1 tw-block">{detail.totalOrders}</strong></div>
              <div className="tw-rounded-2xl tw-bg-amber-50 tw-p-4 dark:tw-bg-amber-500/10"><span className="tw-text-xs tw-text-slate-500">Chi tiêu</span><strong className="tw-mt-1 tw-block">{formatMoney(detail.totalSpending)}</strong></div>
            </div>
            <div>
              <h3 className="tw-text-base tw-font-black">Thông tin liên hệ</h3>
              <div className="tw-grid tw-gap-3 tw-text-sm sm:tw-grid-cols-2">
                <div><span className="tw-text-slate-400">Họ tên:</span> {detail.fullName}</div>
                <div><span className="tw-text-slate-400">Điện thoại:</span> {detail.phone}</div>
                <div><span className="tw-text-slate-400">Email:</span> {detail.email || "—"}</div>
                <div><span className="tw-text-slate-400">Ngày sinh:</span> {formatDate(detail.dateOfBirth)}</div>
              </div>
            </div>
            <div>
              <h3 className="tw-text-base tw-font-black">Lịch sử điểm gần đây</h3>
              <div className="tw-space-y-2">
                {detail.pointTransactions.length ? detail.pointTransactions.map((item) => (
                  <div key={item.id} className="tw-flex tw-items-center tw-justify-between tw-rounded-2xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800">
                    <div><strong className="tw-block tw-text-sm">{item.description}</strong><span className="tw-text-xs tw-text-slate-400">{formatDate(item.createdAt, true)}</span></div>
                    <strong className={item.points >= 0 ? "tw-text-emerald-600" : "tw-text-rose-500"}>{item.points >= 0 ? "+" : ""}{item.points} điểm</strong>
                  </div>
                )) : <div className="tw-text-sm tw-text-slate-400">Chưa có giao dịch điểm.</div>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
