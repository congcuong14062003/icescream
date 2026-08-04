import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import { formatDate, formatMoney } from "../utils/format";
import { useAuth } from "../store/AuthContext";

const labels = { COGS: "Giá vốn hàng bán (COGS)", PERSONNEL: "Chi phí nhân sự", RENT: "Chi phí mặt bằng", UTILITIES: "Chi phí điện nước", MARKETING: "Chi phí Marketing", OPERATIONS: "Chi phí vận hành", SHRINKAGE: "Chi phí hao hụt", MAINTENANCE: "Chi phí bảo trì", FINANCE: "Chi phí tài chính", TAX: "Thuế", DEPRECIATION: "Khấu hao tài sản", OTHER: "Chi phí khác" };
const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const today = () => localDate();
const monthStart = () => localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const empty = { branchId: "", category: "OPERATIONS", amount: 0, description: "", incurredAt: today() };

export default function ExpensesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canSelectBranch = ["ADMIN", "MANAGER"].includes(user.role.code);
  const isAdmin = user.role.code === "ADMIN";
  const [filters, setFilters] = useState({ branchId: canSelectBranch ? "" : user.branch?.id || "", from: monthStart(), to: today(), category: "" });
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: () => api.get("/branches").then((r) => r.data.data) });
  const query = useQuery({ queryKey: ["expenses", filters], queryFn: () => api.get("/expenses", { params: { branchId: filters.branchId || undefined, category: filters.category || undefined, from: filters.from || undefined, to: filters.to || undefined } }).then((r) => r.data.data) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["expenses"] });
  const mutation = useMutation({ mutationFn: () => { const description = form.description.trim(); return editing ? api.put(`/expenses/${editing.id}`, { category: form.category, amount: Number(form.amount), description, incurredAt: form.incurredAt }) : api.post("/expenses", { ...form, amount: Number(form.amount), description, incurredAt: new Date(`${form.incurredAt}T00:00:00`).toISOString() }); }, onSuccess: () => { toast.success(editing ? "Đã cập nhật chi phí" : "Đã ghi nhận chi phí"); setOpen(false); setEditing(null); setForm({ ...empty, branchId: filters.branchId || user.branch?.id || "" }); refresh(); }, onError: (error) => toast.error(apiMessage(error)) });
  const deleteMutation = useMutation({ mutationFn: (id) => api.delete(`/expenses/${id}`), onSuccess: () => { toast.success("Đã xóa chi phí"); refresh(); }, onError: (error) => toast.error(apiMessage(error)) });
  const openCreate = () => { setEditing(null); setForm({ ...empty, branchId: filters.branchId || user.branch?.id || "" }); setOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ branchId: row.branchId, category: row.category, amount: row.amount, description: row.description, incurredAt: row.incurredAt.slice(0, 10) }); setOpen(true); };
  const branchOptions = (branchesQuery.data || []).map((branch) => ({ value: branch.id, label: branch.name }));
  const total = query.data?.totalAmount || 0;
  const columns = useMemo(() => [
    ...(isAdmin ? [{ key: "branch", label: "Chi nhánh", render: (value) => value.name }] : []),
    { key: "incurredAt", label: "Ngày", render: (value) => formatDate(value) },
    { key: "category", label: "Nhóm chi phí", render: (value) => labels[value] || value },
    { key: "description", label: "Nội dung" },
    { key: "createdBy", label: "Người ghi nhận", render: (value) => value.fullName },
    { key: "amount", label: "Số tiền", align: "right", render: (value) => <strong>{formatMoney(value)}</strong> },
    { key: "actions", label: "", align: "right", render: (_, row) => <div className="tw-flex tw-justify-end tw-gap-1"><Button size="small" variant="text" onClick={() => openEdit(row)}><Pencil size={16} /></Button><Button size="small" variant="text" color="error" onClick={() => deleteMutation.mutate(row.id)}><Trash2 size={16} /></Button></div> },
  ], [isAdmin, deleteMutation]);
  return <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
    <PageHeader eyebrow="Expense management" title="Quản lý chi phí" description="Theo dõi chi phí theo nhóm, thời gian và chi nhánh trong phạm vi được phân quyền." actions={<Button startIcon={<Plus size={18} />} onClick={openCreate}>Ghi nhận chi phí</Button>} />
    <div className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-grid-cols-2 lg:tw-grid-cols-5 dark:tw-border-slate-700 dark:tw-bg-slate-900">
      <Input label="Từ ngày" type="date" value={filters.from} onChange={(e) => setFilters((v) => ({ ...v, from: e.target.value }))} InputLabelProps={{ shrink: true }} />
      <Input label="Đến ngày" type="date" value={filters.to} onChange={(e) => setFilters((v) => ({ ...v, to: e.target.value }))} InputLabelProps={{ shrink: true }} />
      <Select label="Chi nhánh" value={filters.branchId} disabled={!canSelectBranch} onChange={(e) => setFilters((v) => ({ ...v, branchId: e.target.value }))} options={[...(canSelectBranch ? [{ value: "", label: isAdmin ? "Tất cả chi nhánh" : "Tất cả chi nhánh được quản lý" }] : []), ...branchOptions]} />
      <Select label="Nhóm chi phí" value={filters.category} onChange={(e) => setFilters((v) => ({ ...v, category: e.target.value }))} options={[{ value: "", label: "Tất cả nhóm" }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} />
      <div className="tw-flex tw-items-center tw-rounded-2xl tw-bg-mint-50 tw-p-4 dark:tw-bg-mint-950/30"><div><div className="tw-text-xs tw-font-bold tw-uppercase tw-text-slate-500">Tổng chi phí</div><strong className="tw-text-xl tw-text-mint-700 dark:tw-text-mint-300">{formatMoney(total)}</strong></div><Receipt className="tw-ml-auto tw-text-mint-600" /></div>
    </div>
    <DataTable columns={columns} rows={query.data?.items || []} loading={query.isLoading} />
    <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Cập nhật chi phí" : "Ghi nhận chi phí"} actions={<><Button variant="text" color="inherit" onClick={() => setOpen(false)}>Hủy</Button><Button loading={mutation.isPending} disabled={!form.branchId || Number(form.amount) <= 0} onClick={() => mutation.mutate()}>Lưu chi phí</Button></>}>
      <div className="tw-grid tw-gap-4 tw-pt-2 sm:tw-grid-cols-2"><Select label="Chi nhánh" value={form.branchId} disabled={Boolean(editing) || !canSelectBranch} onChange={(e) => setForm((v) => ({ ...v, branchId: e.target.value }))} options={branchOptions} /><Select label="Nhóm chi phí" value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))} options={Object.entries(labels).map(([value, label]) => ({ value, label }))} /><Input label="Ngày phát sinh" type="date" value={form.incurredAt} onChange={(e) => setForm((v) => ({ ...v, incurredAt: e.target.value }))} InputLabelProps={{ shrink: true }} /><Input label="Số tiền" type="number" value={form.amount} onChange={(e) => setForm((v) => ({ ...v, amount: e.target.value }))} /><div className="sm:tw-col-span-2"><Input label="Nội dung (không bắt buộc)" helperText="Nếu bỏ trống, hệ thống tự ghi theo nhóm chi phí." multiline rows={4} value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} /></div></div>
    </Modal>
  </div>;
}
