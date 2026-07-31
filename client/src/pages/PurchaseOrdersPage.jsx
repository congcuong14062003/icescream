import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Plus, Trash2, Truck } from "lucide-react";
import { IconButton } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import StatusBadge from "../components/common/StatusBadge";
import { formatDate, formatMoney } from "../utils/format";
import { useAuth } from "../store/AuthContext";

const statusLabels = {
  DRAFT: "Lưu tạm",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  RECEIVED: "Đã nhập kho",
  CANCELLED: "Đã hủy",
};
const transitions = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["APPROVED", "CANCELLED"],
  APPROVED: ["RECEIVED", "CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
};
const emptyLine = { ingredientId: "", quantity: 1, unitCost: 0, batchNumber: "", manufactureDate: "", expiryDate: "" };

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user.role.code === "ADMIN";
  const canSelectBranch = ["ADMIN", "MANAGER"].includes(user.role.code);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [branchFilter, setBranchFilter] = useState(canSelectBranch ? "" : user.branch?.id || "");
  const [form, setForm] = useState({ supplierId: "", branchId: user.branch?.id || "", note: "", items: [{ ...emptyLine }] });
  const ordersQuery = useQuery({
    queryKey: ["purchase-orders", branchFilter],
    queryFn: () => api.get("/purchase-orders", {
      params: { size: 100, branchId: branchFilter || undefined },
    }).then((response) => response.data.data),
  });
  const detailQuery = useQuery({
    queryKey: ["purchase-order", selectedId],
    queryFn: () => api.get(`/purchase-orders/${selectedId}`).then((response) => response.data.data),
    enabled: Boolean(selectedId),
  });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get("/suppliers", { params: { size: 100 } }).then((response) => response.data.data),
  });
  const ingredientsQuery = useQuery({
    queryKey: ["ingredients"],
    queryFn: () => api.get("/inventory/ingredients").then((response) => response.data.data),
  });
  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches").then((response) => response.data.data),
  });

  useEffect(() => {
    const branches = branchesQuery.data || [];
    if (!form.branchId && branches.length) {
      setForm((current) => ({ ...current, branchId: user.branch?.id || branches[0].id }));
    }
  }, [branchesQuery.data, form.branchId, user.branch?.id]);

  const createMutation = useMutation({
    mutationFn: () => api.post("/purchase-orders", {
      ...form,
      items: form.items.map((item) => ({
        ...item,
        manufactureDate: item.manufactureDate || null,
        expiryDate: item.expiryDate || null,
      })),
    }),
    onSuccess: () => {
      toast.success("Đã tạo phiếu nhập kho");
      setCreateOpen(false);
      setForm({ supplierId: "", branchId: user.branch?.id || "", note: "", items: [{ ...emptyLine }] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/purchase-orders/${id}/status`, { status }),
    onSuccess: (_, variables) => {
      toast.success(variables.status === "RECEIVED" ? "Đã xác nhận nhập kho và tăng tồn" : "Đã cập nhật phiếu nhập");
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const updateLine = (index, key, value) => setForm((current) => ({ ...current, items: current.items.map((item, position) => position === index ? { ...item, [key]: value } : item) }));
  const total = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);
  const valid = form.supplierId && form.branchId && form.items.every((item) => item.ingredientId && item.batchNumber && Number(item.quantity) > 0);
  const columns = [
    { key: "code", label: "Mã phiếu", render: (value, row) => <div><strong>{value}</strong><div className="tw-text-xs tw-text-slate-400">{formatDate(row.createdAt, true)}</div></div> },
    { key: "supplier", label: "Nhà cung cấp", render: (value) => value.name },
    { key: "branch", label: "Chi nhánh nhận", render: (value) => value.name },
    { key: "items", label: "Nguyên liệu", render: (value) => `${value.length} dòng` },
    { key: "totalAmount", label: "Tổng tiền", align: "right", render: (value) => <strong>{formatMoney(value)}</strong> },
    { key: "status", label: "Trạng thái", render: (value) => <StatusBadge status={value} label={statusLabels[value]} /> },
    { key: "action", label: "", align: "right", render: (_, row) => <IconButton onClick={() => setSelectedId(row.id)}><Eye size={18} /></IconButton> },
  ];
  const detail = detailQuery.data;
  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Nhà cung cấp & nhập hàng"
        title="Phiếu nhập kho"
        description="Tồn kho chỉ tăng khi phiếu đã duyệt được xác nhận ở trạng thái Đã nhập kho."
        actions={<Button startIcon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>Tạo phiếu nhập</Button>}
      />
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <div className="tw-mb-4 tw-max-w-sm">
          <Select
            label="Chi nhánh nhận"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            options={[
              ...(canSelectBranch ? [{ value: "", label: isAdmin ? "Tất cả chi nhánh" : "Tất cả chi nhánh được quản lý" }] : []),
              ...(branchesQuery.data || []).map((branch) => ({ value: branch.id, label: branch.name })),
            ]}
            disabled={!canSelectBranch}
          />
        </div>
        <DataTable columns={columns} rows={ordersQuery.data || []} loading={ordersQuery.isLoading} />
      </div>
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo phiếu nhập kho"
        maxWidth="lg"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button loading={createMutation.isPending} disabled={!valid} onClick={() => createMutation.mutate()}>Lưu phiếu · {formatMoney(total)}</Button>
          </>
        }
      >
        <div className="tw-space-y-5 tw-pt-2">
          <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
            <Select label="Nhà cung cấp" value={form.supplierId} onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))} options={(suppliersQuery.data || []).map((item) => ({ value: item.id, label: item.name }))} />
            <Select label="Chi nhánh nhận" value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))} options={(branchesQuery.data || []).map((item) => ({ value: item.id, label: item.name }))} disabled={!canSelectBranch} />
          </div>
          <Input label="Ghi chú phiếu" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
          <div className="tw-flex tw-items-center tw-justify-between"><h3 className="tw-m-0 tw-text-base tw-font-black">Danh sách nguyên liệu</h3><Button variant="outlined" size="small" startIcon={<Plus size={15} />} onClick={() => setForm((current) => ({ ...current, items: [...current.items, { ...emptyLine }] }))}>Thêm dòng</Button></div>
          <div className="tw-space-y-3">
            {form.items.map((line, index) => (
              <div key={index} className="tw-grid tw-gap-3 tw-rounded-2xl tw-bg-slate-50 tw-p-3 md:tw-grid-cols-3 lg:tw-grid-cols-6 dark:tw-bg-slate-800">
                <div className="lg:tw-col-span-2"><Select label="Nguyên liệu" value={line.ingredientId} onChange={(event) => updateLine(index, "ingredientId", event.target.value)} options={(ingredientsQuery.data || []).map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))} /></div>
                <Input label="Số lượng" type="number" value={line.quantity} onChange={(event) => updateLine(index, "quantity", Number(event.target.value))} />
                <Input label="Đơn giá" type="number" value={line.unitCost} onChange={(event) => updateLine(index, "unitCost", Number(event.target.value))} />
                <Input label="Số lô" value={line.batchNumber} onChange={(event) => updateLine(index, "batchNumber", event.target.value)} />
                <div className="tw-flex tw-items-center tw-gap-1">
                  <Input label="Hạn sử dụng" type="date" InputLabelProps={{ shrink: true }} value={line.expiryDate} onChange={(event) => updateLine(index, "expiryDate", event.target.value)} />
                  <IconButton color="error" disabled={form.items.length === 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, position) => position !== index) }))}><Trash2 size={17} /></IconButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={detail ? `Phiếu ${detail.code}` : "Chi tiết phiếu nhập"}
        maxWidth="md"
        actions={detail && transitions[detail.status].map((status) => (
          <Button key={status} color={status === "CANCELLED" ? "error" : "primary"} variant={status === "CANCELLED" ? "outlined" : "contained"} loading={statusMutation.isPending} startIcon={status === "RECEIVED" ? <Truck size={17} /> : status === "APPROVED" ? <CheckCircle2 size={17} /> : undefined} onClick={() => statusMutation.mutate({ id: detail.id, status })}>
            {status === "RECEIVED" ? "Xác nhận nhập kho" : statusLabels[status]}
          </Button>
        ))}
      >
        {detail && (
          <div className="tw-space-y-5">
            <div className="tw-grid tw-gap-3 sm:tw-grid-cols-3">
              <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800"><span className="tw-text-xs tw-text-slate-400">Nhà cung cấp</span><strong className="tw-mt-1 tw-block">{detail.supplier.name}</strong></div>
              <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800"><span className="tw-text-xs tw-text-slate-400">Chi nhánh</span><strong className="tw-mt-1 tw-block">{detail.branch.name}</strong></div>
              <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800"><span className="tw-text-xs tw-text-slate-400">Trạng thái</span><div className="tw-mt-1"><StatusBadge status={detail.status} label={statusLabels[detail.status]} /></div></div>
            </div>
            <DataTable columns={[
              { key: "ingredient", label: "Nguyên liệu", render: (value) => value.name },
              { key: "batchNumber", label: "Số lô" },
              { key: "quantity", label: "Số lượng", align: "right", render: (value, row) => `${value.toLocaleString("vi-VN")} ${row.ingredient.unit}` },
              { key: "unitCost", label: "Đơn giá", align: "right", render: formatMoney },
              { key: "lineTotal", label: "Thành tiền", align: "right", render: formatMoney },
            ]} rows={detail.items} />
            <div className="tw-text-right tw-text-xl tw-font-black">Tổng cộng: {formatMoney(detail.totalAmount)}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
