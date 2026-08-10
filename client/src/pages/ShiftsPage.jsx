import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CircleDollarSign, Eye, LockKeyhole, Plus, ReceiptText, WalletCards } from "lucide-react";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import EmptyState from "../components/common/EmptyState";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import StatusBadge from "../components/common/StatusBadge";
import { formatDate, formatMoney } from "../utils/format";
import { useAuth } from "../store/AuthContext";

export default function ShiftsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [openingCash, setOpeningCash] = useState(1000000);
  const [openNote, setOpenNote] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [countedCash, setCountedCash] = useState(0);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expense, setExpense] = useState({ amount: 0, description: "" });
  const [historyShift, setHistoryShift] = useState(null);
  const currentQuery = useQuery({
    queryKey: ["current-shift"],
    queryFn: () => api.get("/shifts/current").then((response) => response.data.data),
  });
  const shiftsQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: () => api.get("/shifts").then((response) => response.data.data),
  });
  const current = currentQuery.data;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["current-shift"] });
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
  };
  const openMutation = useMutation({
    mutationFn: () => api.post("/shifts/open", { branchId: user.branch?.id, openingCash: Number(openingCash), note: openNote || null }),
    onSuccess: () => { toast.success("Đã mở ca, bạn có thể tạo đơn"); refresh(); },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const closeMutation = useMutation({
    mutationFn: () => api.post(`/shifts/${current.id}/close`, { countedCash: Number(countedCash) }),
    onSuccess: () => { toast.success("Đã đóng ca"); setCloseOpen(false); refresh(); },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const expenseMutation = useMutation({
    mutationFn: () => api.post(`/shifts/${current.id}/expenses`, { ...expense, amount: Number(expense.amount) }),
    onSuccess: () => {
      toast.success("Đã ghi nhận chi phí");
      setExpenseOpen(false);
      setExpense({ amount: 0, description: "" });
      refresh();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const expectedCash = current
    ? current.openingCash + current.cashRevenue - current.refundAmount - current.expenseAmount
    : 0;
  const columns = [
    { key: "code", label: "Mã ca", render: (value, row) => <div><strong>{value}</strong><div className="tw-text-xs tw-text-slate-400">{row.user.fullName}</div></div> },
    { key: "branch", label: "Chi nhánh", render: (value) => value.name },
    { key: "openedAt", label: "Mở ca", render: (value) => formatDate(value, true) },
    { key: "openingCash", label: "Đầu ca", align: "right", render: (value) => formatMoney(value) },
    { key: "cashRevenue", label: "Tiền mặt", align: "right", render: (value) => formatMoney(value) },
    { key: "expenseAmount", label: "Chi phí ca", align: "right", render: (value) => <strong className={value > 0 ? "tw-text-rose-500" : "tw-text-slate-400"}>{formatMoney(value)}</strong> },
    { key: "status", label: "Trạng thái", render: (value) => <StatusBadge status={value} label={value === "OPEN" ? "Đang mở" : "Đã đóng"} /> },
    { key: "actions", label: "", align: "right", render: (_, row) => <Button size="small" variant="outlined" startIcon={<Eye size={15} />} onClick={() => setHistoryShift(row)}>Chi tiết</Button> },
  ];

  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Quản lý quỹ tại quầy"
        title="Ca làm việc"
        description="POS chỉ cho tạo đơn khi nhân viên có ca đang mở tại đúng chi nhánh."
      />
      {current ? (
        <section className="professional-grid tw-rounded-2xl tw-bg-[#0b3a32] tw-p-6 tw-text-white tw-shadow-floating">
          <div className="tw-flex tw-flex-col tw-gap-5 sm:tw-flex-row sm:tw-items-start sm:tw-justify-between">
            <div>
              <span className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-white/10 tw-bg-white/[0.07] tw-px-3 tw-py-1.5 tw-text-[10px] tw-font-bold tw-uppercase tw-tracking-wider"><span className="tw-h-1.5 tw-w-1.5 tw-rounded-full tw-bg-emerald-300" /> CA ĐANG MỞ</span>
              <h2 className="tw-mb-1 tw-mt-4 tw-text-2xl tw-font-black">{current.code}</h2>
              <p className="tw-m-0 tw-text-sm tw-text-white/75">{current.branch.name} · mở lúc {formatDate(current.openedAt, true)}</p>
            </div>
            <div className="tw-flex tw-gap-2">
              <Button variant="outlined" sx={{ color: "white", borderColor: "rgba(255,255,255,.5)" }} startIcon={<Plus size={17} />} onClick={() => setExpenseOpen(true)}>Ghi chi phí</Button>
              <Button sx={{ bgcolor: "white", color: "#287e74", "&:hover": { bgcolor: "#effcf9" } }} startIcon={<LockKeyhole size={17} />} onClick={() => { setCountedCash(expectedCash); setCloseOpen(true); }}>Đóng ca</Button>
            </div>
          </div>
          <div className="tw-mt-6 tw-grid tw-gap-3 sm:tw-grid-cols-2 lg:tw-grid-cols-4">
            {[
              ["Tiền đầu ca", current.openingCash, WalletCards],
              ["Doanh thu tiền mặt", current.cashRevenue, Banknote],
              ["Chuyển khoản & thẻ", current.transferRevenue + current.cardRevenue + current.ewalletRevenue, CircleDollarSign],
              ["Số đơn trong ca", current.orders.length, ReceiptText, true],
            ].map(([label, value, Icon, count]) => (
              <div key={label} className="tw-rounded-xl tw-border tw-border-white/10 tw-bg-white/[0.07] tw-p-4 tw-backdrop-blur">
                <Icon size={20} className="tw-mb-3" /><span className="tw-block tw-text-xs tw-text-white/70">{label}</span><strong className="tw-mt-1 tw-block tw-text-xl">{count ? value : formatMoney(value)}</strong>
              </div>
            ))}
          </div>
          <div className="tw-mt-4 tw-grid tw-gap-2 tw-text-sm sm:tw-grid-cols-3">
            <div>Hoàn trả: <strong>{formatMoney(current.refundAmount)}</strong></div>
            <div>Chi phí: <strong>{formatMoney(current.expenseAmount)}</strong></div>
            <div>Tiền mặt dự kiến: <strong>{formatMoney(expectedCash)}</strong></div>
          </div>
        </section>
      ) : (
        <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-6 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
          <EmptyState
            title="Bạn chưa mở ca"
            description={`Mở ca tại ${user.branch?.name || "chi nhánh được gán"} để bắt đầu bán hàng.`}
            action={
              <div className="tw-mt-2 tw-w-full tw-max-w-sm tw-space-y-3">
                <Input label="Tiền đầu ca" type="number" value={openingCash} onChange={(event) => setOpeningCash(Math.max(0, Number(event.target.value)))} />
                <Input label="Ghi chú" value={openNote} onChange={(event) => setOpenNote(event.target.value)} />
                <Button fullWidth loading={openMutation.isPending} onClick={() => openMutation.mutate()}>Mở ca ngay</Button>
              </div>
            }
          />
        </section>
      )}
      <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <h3 className="tw-mb-4 tw-mt-1 tw-text-lg tw-font-black">Lịch sử ca làm việc</h3>
        <DataTable columns={columns} rows={shiftsQuery.data || []} loading={shiftsQuery.isLoading} />
      </section>
      <Modal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Ghi nhận chi phí phát sinh"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setExpenseOpen(false)}>Hủy</Button>
            <Button loading={expenseMutation.isPending} disabled={expense.amount <= 0 || !expense.description.trim()} onClick={() => expenseMutation.mutate()}>Ghi chi phí</Button>
          </>
        }
      >
        <div className="tw-space-y-4 tw-pt-2">
          <Input label="Số tiền" type="number" value={expense.amount} onChange={(event) => setExpense((currentValue) => ({ ...currentValue, amount: Number(event.target.value) }))} />
          <Input label="Nội dung chi" multiline rows={3} value={expense.description} onChange={(event) => setExpense((currentValue) => ({ ...currentValue, description: event.target.value }))} />
        </div>
      </Modal>
      <Modal
        open={Boolean(historyShift)}
        onClose={() => setHistoryShift(null)}
        title={`Chi tiết chi phí ca ${historyShift?.code || ""}`}
        actions={<Button onClick={() => setHistoryShift(null)}>Đóng</Button>}
      >
        <div className="tw-space-y-4 tw-pt-2">
          <div className="tw-grid tw-gap-3 sm:tw-grid-cols-3">
            <div className="tw-rounded-xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800"><span className="tw-block tw-text-xs tw-text-slate-500">Nhân viên</span><strong>{historyShift?.user?.fullName}</strong></div>
            <div className="tw-rounded-xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800"><span className="tw-block tw-text-xs tw-text-slate-500">Chi nhánh</span><strong>{historyShift?.branch?.name}</strong></div>
            <div className="tw-rounded-xl tw-bg-rose-50 tw-p-3 dark:tw-bg-rose-950/30"><span className="tw-block tw-text-xs tw-text-slate-500">Tổng chi phí</span><strong className="tw-text-rose-600">{formatMoney(historyShift?.expenseAmount || 0)}</strong></div>
          </div>
          {(historyShift?.expenses || []).length ? (
            <div className="tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200 dark:tw-border-slate-700">
              {historyShift.expenses.map((item) => (
                <div key={item.id} className="tw-flex tw-flex-col tw-gap-2 tw-border-b tw-border-slate-100 tw-p-4 last:tw-border-b-0 sm:tw-flex-row sm:tw-items-center dark:tw-border-slate-800">
                  <div className="tw-min-w-0 tw-flex-1"><strong className="tw-block tw-break-words">{item.description}</strong><span className="tw-text-xs tw-text-slate-400">{formatDate(item.createdAt, true)} · {item.createdBy?.fullName}</span></div>
                  <strong className="tw-whitespace-nowrap tw-text-rose-600">{formatMoney(item.amount)}</strong>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Chưa có chi phí" description="Ca làm việc này chưa ghi nhận khoản chi nào." />}
        </div>
      </Modal>
      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Kiểm đếm và đóng ca"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setCloseOpen(false)}>Hủy</Button>
            <Button color="warning" loading={closeMutation.isPending} onClick={() => closeMutation.mutate()}>Đóng ca</Button>
          </>
        }
      >
        <div className="tw-space-y-4 tw-pt-2">
          <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-4 tw-text-sm dark:tw-bg-slate-800">
            Tiền mặt dự kiến: <strong>{formatMoney(expectedCash)}</strong>
          </div>
          <Input label="Tiền mặt kiểm đếm thực tế" type="number" value={countedCash} onChange={(event) => setCountedCash(Math.max(0, Number(event.target.value)))} />
          <div className="tw-text-sm">Chênh lệch: <strong className={countedCash - expectedCash === 0 ? "tw-text-emerald-600" : "tw-text-rose-500"}>{formatMoney(countedCash - expectedCash)}</strong></div>
        </div>
      </Modal>
    </div>
  );
}
