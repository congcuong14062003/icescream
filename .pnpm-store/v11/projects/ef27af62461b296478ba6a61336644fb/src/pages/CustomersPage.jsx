import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Crown, Edit3, Eye, Gift, Plus, Search, Star } from "lucide-react";
import { IconButton, InputAdornment } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import Input from "../components/common/Input";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import { formatDate, formatMoney } from "../utils/format";
import { useAuth } from "../store/AuthContext";
import MembershipEnrollDialog from "../features/customers/MembershipEnrollDialog";

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
  const queryClient = useQueryClient();
  const canManage = hasPermission("customers.manage");
  const [search, setSearch] = useState("");
  const [paidMembership, setPaidMembership] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [enrollCustomer, setEnrollCustomer] = useState(null);
  const customersQuery = useQuery({
    queryKey: ["customers", search, paidMembership],
    queryFn: () => api.get("/customers", {
      params: { search, paidMembership: paidMembership || undefined, size: 100 },
    }).then((response) => response.data.data),
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
    {
      key: "activeMembership",
      label: "Hội viên trả phí",
      render: (value) => value ? (
        <div>
          <span className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-bg-mint-50 tw-px-2.5 tw-py-1 tw-text-xs tw-font-bold tw-text-mint-700 dark:tw-bg-mint-900/20">
            <Crown size={13} /> Đang hiệu lực
          </span>
          <span className="tw-mt-1 tw-block tw-text-[10px] tw-text-slate-400">Đến {formatDate(value.endsAt)}</span>
        </div>
      ) : <span className="tw-text-xs tw-text-slate-400">Chưa đăng ký</span>,
    },
    { key: "totalSpending", label: "Tổng chi tiêu", align: "right", render: (value) => formatMoney(value) },
    { key: "points", label: "Điểm xếp hạng", align: "right", render: (value) => <strong className="tw-text-mint-700">{value.toLocaleString("vi-VN")}</strong> },
    { key: "actions", label: "", align: "right", render: (_, row) => <div className="tw-whitespace-nowrap"><IconButton onClick={() => setSelectedId(row.id)}><Eye size={17} /></IconButton>{canManage && <IconButton onClick={() => { setEditing(row); setFormOpen(true); }}><Edit3 size={17} /></IconButton>}</div> },
  ];
  const detail = detailQuery.data;
  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Khách hàng thân thiết"
        title="Khách hàng"
        description="Điểm chỉ dùng để xét hạng. Khi khách lên hạng, hệ thống tự cấp voucher theo chính sách quản lý đã cấu hình."
        actions={canManage && <Button startIcon={<Plus size={18} />} onClick={() => { setEditing(null); setFormOpen(true); }}>Thêm khách hàng</Button>}
      />
      <div className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-grid-cols-[minmax(0,1fr)_260px] sm:tw-items-center dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <Input placeholder="Tìm theo tên, mã, số điện thoại..." value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }} />
        <Select
          label="Hội viên trả phí"
          value={paidMembership}
          onChange={(event) => setPaidMembership(event.target.value)}
          options={[
            { value: "", label: "Tất cả khách hàng" },
            { value: "ACTIVE", label: "Đang có hội viên trả phí" },
            { value: "INACTIVE", label: "Chưa có / đã hết hạn" },
          ]}
        />
      </div>
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <DataTable columns={columns} rows={customersQuery.data || []} loading={customersQuery.isLoading} />
      </div>
      <CustomerForm open={formOpen} customer={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
      <Modal open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title="Hồ sơ khách hàng" maxWidth="md">
        {detailQuery.isLoading ? <LoadingSkeleton rows={5} /> : detail && (
          <div className="tw-space-y-6">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-rounded-2xl tw-border tw-border-mint-200 tw-bg-mint-50 tw-p-4 dark:tw-border-mint-800 dark:tw-bg-mint-900/20">
              <div className="tw-flex tw-items-center tw-gap-3">
                <span className="tw-flex tw-h-11 tw-w-11 tw-items-center tw-justify-center tw-rounded-xl tw-bg-white tw-text-mint-700 tw-shadow-sm dark:tw-bg-slate-900">
                  <Crown size={22} />
                </span>
                <div>
                  <strong className="tw-block tw-text-sm">
                    {detail.activeMembership ? detail.activeMembership.plan.name : "Chưa có gói hội viên trả phí"}
                  </strong>
                  <span className="tw-text-xs tw-text-slate-500">
                    {detail.activeMembership
                      ? `Hiệu lực đến ${formatDate(detail.activeMembership.endsAt)}`
                      : "Đăng ký để nhận quyền lợi miễn phí mỗi ngày"}
                  </span>
                </div>
              </div>
              {canManage && (
                <Button
                  size="small"
                  startIcon={<Crown size={16} />}
                  onClick={() => setEnrollCustomer(detail)}
                >
                  {detail.activeMembership ? "Gia hạn" : "Đăng ký hội viên"}
                </Button>
              )}
            </div>
            <div className="tw-grid tw-gap-3 sm:tw-grid-cols-4">
              <div className="tw-rounded-2xl tw-bg-mint-50 tw-p-4 dark:tw-bg-mint-700/20"><span className="tw-text-xs tw-text-slate-500">Hạng</span><strong className="tw-mt-1 tw-block">{detail.membershipLevel.name}</strong></div>
              <div className="tw-rounded-2xl tw-bg-blush-50 tw-p-4 dark:tw-bg-blush-500/10"><span className="tw-text-xs tw-text-slate-500">Điểm xếp hạng</span><strong className="tw-mt-1 tw-block">{detail.points}</strong></div>
              <div className="tw-rounded-2xl tw-bg-lavender-50 tw-p-4 dark:tw-bg-lavender-500/10"><span className="tw-text-xs tw-text-slate-500">Số đơn</span><strong className="tw-mt-1 tw-block">{detail.totalOrders}</strong></div>
              <div className="tw-rounded-2xl tw-bg-amber-50 tw-p-4 dark:tw-bg-amber-500/10"><span className="tw-text-xs tw-text-slate-500">Chi tiêu</span><strong className="tw-mt-1 tw-block">{formatMoney(detail.totalSpending)}</strong></div>
            </div>
            <div>
              <div className="tw-mb-2 tw-flex tw-items-center tw-justify-between">
                <h3 className="tw-m-0 tw-text-base tw-font-black">Voucher theo hạng</h3>
                <span className="tw-text-xs tw-text-slate-400">
                  {detail.activeVouchers?.length || 0} voucher dùng được
                </span>
              </div>
              <div className="tw-space-y-2">
                {detail.vouchers?.length ? detail.vouchers.map((voucher) => (
                  <div key={voucher.id} className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-100 tw-bg-slate-50 tw-p-3 dark:tw-border-slate-700 dark:tw-bg-slate-800">
                    <div className="tw-flex tw-items-center tw-gap-3">
                      <span className={`tw-flex tw-h-9 tw-w-9 tw-items-center tw-justify-center tw-rounded-lg ${
                        voucher.status === "ACTIVE"
                          ? "tw-bg-mint-100 tw-text-mint-700 dark:tw-bg-mint-900/30"
                          : "tw-bg-slate-200 tw-text-slate-500 dark:tw-bg-slate-700"
                      }`}>
                        <Gift size={17} />
                      </span>
                      <div>
                        <strong className="tw-block tw-text-sm">{voucher.code}</strong>
                        <span className="tw-text-xs tw-text-slate-400">
                          Hạng {voucher.membershipLevel.name} ·{" "}
                          {voucher.type === "PERCENT"
                            ? `giảm ${voucher.value}%`
                            : `giảm ${formatMoney(voucher.value)}`} · {voucher.branch.name}
                        </span>
                      </div>
                    </div>
                    <div className="tw-text-right">
                      <strong className={`tw-block tw-text-xs ${
                        voucher.status === "ACTIVE"
                          ? "tw-text-emerald-600"
                          : voucher.status === "USED"
                            ? "tw-text-slate-600 dark:tw-text-slate-300"
                            : "tw-text-rose-500"
                      }`}>
                        {{
                          ACTIVE: "Có thể sử dụng",
                          USED: "Đã sử dụng",
                          EXPIRED: "Đã hết hạn",
                          CANCELLED: "Đã hủy",
                        }[voucher.status]}
                      </strong>
                      <span className="tw-text-[10px] tw-text-slate-400">
                        {voucher.status === "USED"
                          ? `Dùng ${formatDate(voucher.usedAt, true)}`
                          : `Hạn ${formatDate(voucher.expiresAt)}`}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-4 tw-text-sm tw-text-slate-400 dark:tw-bg-slate-800">
                    Chưa có voucher theo hạng.
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="tw-text-base tw-font-black">Lịch sử gói hội viên</h3>
              <div className="tw-space-y-2">
                {detail.membershipSubscriptions?.length ? detail.membershipSubscriptions.map((item) => (
                  <div key={item.id} className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-rounded-2xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800">
                    <div className="tw-flex tw-items-center tw-gap-3">
                      <span className="tw-flex tw-h-9 tw-w-9 tw-items-center tw-justify-center tw-rounded-lg tw-bg-mint-100 tw-text-mint-700 dark:tw-bg-mint-900/30">
                        <CalendarDays size={17} />
                      </span>
                      <div>
                        <strong className="tw-block tw-text-sm">{item.membershipPlan.name}</strong>
                        <span className="tw-text-xs tw-text-slate-400">
                          {formatDate(item.startsAt)} – {formatDate(item.endsAt)}
                        </span>
                      </div>
                    </div>
                    <div className="tw-text-right">
                      <strong className="tw-block tw-text-sm">{formatMoney(item.amountPaid)}</strong>
                      <span className="tw-flex tw-items-center tw-justify-end tw-gap-1 tw-text-[10px] tw-text-slate-400">
                        <Gift size={12} /> Đã nhận {item.benefitUsages.length} ngày
                      </span>
                    </div>
                  </div>
                )) : <div className="tw-text-sm tw-text-slate-400">Chưa có lần đăng ký hội viên.</div>}
              </div>
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
              <h3 className="tw-text-base tw-font-black">Lịch sử điểm xếp hạng</h3>
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
      <MembershipEnrollDialog
        open={Boolean(enrollCustomer)}
        customer={enrollCustomer}
        onClose={() => setEnrollCustomer(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["customer", selectedId] });
          queryClient.invalidateQueries({ queryKey: ["customers"] });
        }}
      />
    </div>
  );
}
