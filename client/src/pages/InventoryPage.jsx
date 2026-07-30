import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, PackagePlus, Plus, Search, SlidersHorizontal } from "lucide-react";
import { InputAdornment } from "@mui/material";
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

const adjustmentTypes = [
  { value: "ADJUST_IN", label: "Điều chỉnh tăng" },
  { value: "ADJUST_OUT", label: "Điều chỉnh giảm" },
  { value: "WASTE", label: "Xuất hủy / hao hụt" },
  { value: "STOCKTAKE", label: "Chốt số kiểm kê thực tế" },
];

export default function InventoryPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission("inventory.manage");
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState(user.branch?.id || "");
  const [search, setSearch] = useState("");
  const [adjusting, setAdjusting] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: "ADJUST_IN", quantity: 0, note: "" });
  const [ingredientOpen, setIngredientOpen] = useState(false);
  const [ingredientForm, setIngredientForm] = useState({ code: "", name: "", unit: "g", minStock: 0, lastCost: 0, averageCost: 0, warehouseLocation: "" });

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches").then((response) => response.data.data),
  });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", branchId, search],
    queryFn: () => api.get("/inventory", { params: { branchId, search, size: 100 } }).then((response) => response.data.data),
    enabled: Boolean(branchId),
  });
  const alertsQuery = useQuery({
    queryKey: ["inventory-alerts", branchId],
    queryFn: () => api.get("/inventory/alerts", { params: { branchId } }).then((response) => response.data.data),
    enabled: Boolean(branchId),
  });
  const transactionsQuery = useQuery({
    queryKey: ["inventory-transactions", branchId],
    queryFn: () => api.get("/inventory/transactions", { params: { branchId, size: 20 } }).then((response) => response.data.data),
    enabled: Boolean(branchId),
  });

  const adjustMutation = useMutation({
    mutationFn: () => api.post("/inventory/adjust", {
      branchId,
      ingredientId: adjusting.ingredientId,
      ...adjustForm,
      quantity: Number(adjustForm.quantity),
    }),
    onSuccess: () => {
      toast.success("Đã cập nhật tồn kho");
      setAdjusting(null);
      setAdjustForm({ type: "ADJUST_IN", quantity: 0, note: "" });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const ingredientMutation = useMutation({
    mutationFn: () => api.post("/inventory/ingredients", {
      ...ingredientForm,
      minStock: Number(ingredientForm.minStock),
      lastCost: Number(ingredientForm.lastCost),
      averageCost: Number(ingredientForm.averageCost),
    }),
    onSuccess: () => {
      toast.success("Đã tạo nguyên liệu và tồn kho ban đầu");
      setIngredientOpen(false);
      setIngredientForm({ code: "", name: "", unit: "g", minStock: 0, lastCost: 0, averageCost: 0, warehouseLocation: "" });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const columns = [
    { key: "ingredient", label: "Nguyên liệu", render: (value) => <div><strong>{value.name}</strong><div className="tw-text-xs tw-text-slate-400">{value.code} · {value.warehouseLocation || "Chưa có vị trí"}</div></div> },
    { key: "quantity", label: "Tồn hiện tại", align: "right", render: (value, row) => <strong className={row.isLowStock ? "tw-text-rose-500" : "tw-text-emerald-600"}>{value.toLocaleString("vi-VN")} {row.ingredient.unit}</strong> },
    { key: "minStock", label: "Tồn tối thiểu", align: "right", render: (_, row) => `${row.ingredient.minStock.toLocaleString("vi-VN")} ${row.ingredient.unit}` },
    { key: "cost", label: "Giá vốn TB", align: "right", render: (_, row) => formatMoney(row.ingredient.averageCost) },
    { key: "supplier", label: "Nhà cung cấp", render: (_, row) => row.ingredient.supplier?.name || "—" },
    ...(canManage ? [{ key: "action", label: "", align: "right", render: (_, row) => <Button variant="outlined" size="small" startIcon={<SlidersHorizontal size={15} />} onClick={() => setAdjusting(row)}>Điều chỉnh</Button> }] : []),
  ];
  const transactionColumns = [
    { key: "createdAt", label: "Thời gian", render: (value) => formatDate(value, true) },
    { key: "ingredient", label: "Nguyên liệu", render: (value) => value.name },
    { key: "type", label: "Loại", render: (value) => adjustmentTypes.find((item) => item.value === value)?.label || value },
    { key: "quantity", label: "Biến động", align: "right", render: (value, row) => <strong className={value >= 0 ? "tw-text-emerald-600" : "tw-text-rose-500"}>{value >= 0 ? "+" : ""}{value.toLocaleString("vi-VN")} {row.ingredient.unit}</strong> },
    { key: "balanceAfter", label: "Sau giao dịch", align: "right", render: (value, row) => `${value.toLocaleString("vi-VN")} ${row.ingredient.unit}` },
    { key: "createdBy", label: "Người thực hiện", render: (value) => value.fullName },
  ];

  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Định lượng & lô hàng"
        title="Kho nguyên liệu"
        description="Không cho tồn âm; mọi điều chỉnh đều ghi lịch sử và audit log."
        actions={canManage && <Button startIcon={<PackagePlus size={18} />} onClick={() => setIngredientOpen(true)}>Thêm nguyên liệu</Button>}
      />
      <div className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-grid-cols-2 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <Select
          label="Chi nhánh"
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
          options={(branchesQuery.data || []).map((branch) => ({ value: branch.id, label: branch.name }))}
          disabled={!["ADMIN", "MANAGER"].includes(user.role.code)}
        />
        <Input placeholder="Tìm nguyên liệu hoặc mã..." value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }} />
      </div>
      <div className="tw-grid tw-gap-4 lg:tw-grid-cols-2">
        <div className="tw-rounded-2xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-p-4 dark:tw-border-amber-800 dark:tw-bg-amber-900/15">
          <div className="tw-flex tw-items-center tw-gap-2 tw-font-black tw-text-amber-700"><AlertTriangle size={18} /> Sắp hết hàng</div>
          <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
            {alertsQuery.data?.lowStock.length ? alertsQuery.data.lowStock.slice(0, 8).map((item) => (
              <span key={item.id} className="tw-rounded-full tw-bg-white tw-px-3 tw-py-1.5 tw-text-xs tw-font-bold dark:tw-bg-slate-800">{item.ingredient.name}: {item.quantity} {item.ingredient.unit}</span>
            )) : <span className="tw-text-sm tw-text-slate-500">Tồn kho đang ổn định.</span>}
          </div>
        </div>
        <div className="tw-rounded-2xl tw-border tw-border-rose-200 tw-bg-rose-50 tw-p-4 dark:tw-border-rose-800 dark:tw-bg-rose-900/10">
          <div className="tw-flex tw-items-center tw-gap-2 tw-font-black tw-text-blush-500"><AlertTriangle size={18} /> Sắp hết hạn trong 14 ngày</div>
          <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
            {alertsQuery.data?.expiringBatches.length ? alertsQuery.data.expiringBatches.slice(0, 8).map((batch) => (
              <span key={batch.id} className="tw-rounded-full tw-bg-white tw-px-3 tw-py-1.5 tw-text-xs tw-font-bold dark:tw-bg-slate-800">{batch.ingredient.name} · {formatDate(batch.expiryDate)}</span>
            )) : <span className="tw-text-sm tw-text-slate-500">Không có lô sắp hết hạn.</span>}
          </div>
        </div>
      </div>
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <DataTable columns={columns} rows={inventoryQuery.data || []} loading={inventoryQuery.isLoading} />
      </div>
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <h3 className="tw-mb-4 tw-mt-1 tw-flex tw-items-center tw-gap-2 tw-text-lg tw-font-black"><History size={20} /> Biến động gần đây</h3>
        <DataTable columns={transactionColumns} rows={transactionsQuery.data || []} loading={transactionsQuery.isLoading} />
      </div>

      <Modal
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        title={`Điều chỉnh ${adjusting?.ingredient.name || ""}`}
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setAdjusting(null)}>Hủy</Button>
            <Button loading={adjustMutation.isPending} disabled={!adjustForm.note.trim() || Number(adjustForm.quantity) <= 0} onClick={() => adjustMutation.mutate()}>Ghi nhận</Button>
          </>
        }
      >
        <div className="tw-space-y-4 tw-pt-2">
          <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-4 tw-text-sm dark:tw-bg-slate-800">Tồn hiện tại: <strong>{adjusting?.quantity.toLocaleString("vi-VN")} {adjusting?.ingredient.unit}</strong></div>
          <Select label="Loại điều chỉnh" value={adjustForm.type} onChange={(event) => setAdjustForm((current) => ({ ...current, type: event.target.value }))} options={adjustmentTypes} />
          <Input label={adjustForm.type === "STOCKTAKE" ? "Số lượng kiểm đếm thực tế" : "Số lượng điều chỉnh"} type="number" value={adjustForm.quantity} onChange={(event) => setAdjustForm((current) => ({ ...current, quantity: event.target.value }))} />
          <Input label="Lý do / ghi chú" multiline rows={3} value={adjustForm.note} onChange={(event) => setAdjustForm((current) => ({ ...current, note: event.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={ingredientOpen}
        onClose={() => setIngredientOpen(false)}
        title="Thêm nguyên liệu"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setIngredientOpen(false)}>Hủy</Button>
            <Button loading={ingredientMutation.isPending} disabled={!ingredientForm.code.trim() || !ingredientForm.name.trim()} onClick={() => ingredientMutation.mutate()}>Tạo nguyên liệu</Button>
          </>
        }
      >
        <div className="tw-grid tw-gap-4 tw-pt-2 sm:tw-grid-cols-2">
          <Input label="Mã nguyên liệu" value={ingredientForm.code} onChange={(event) => setIngredientForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} />
          <Input label="Tên nguyên liệu" value={ingredientForm.name} onChange={(event) => setIngredientForm((current) => ({ ...current, name: event.target.value }))} />
          <Select label="Đơn vị" value={ingredientForm.unit} onChange={(event) => setIngredientForm((current) => ({ ...current, unit: event.target.value }))} options={["g", "kg", "ml", "lít", "cái", "hộp", "gói"].map((value) => ({ value, label: value }))} />
          <Input label="Tồn tối thiểu" type="number" value={ingredientForm.minStock} onChange={(event) => setIngredientForm((current) => ({ ...current, minStock: event.target.value }))} />
          <Input label="Giá nhập gần nhất" type="number" value={ingredientForm.lastCost} onChange={(event) => setIngredientForm((current) => ({ ...current, lastCost: event.target.value }))} />
          <Input label="Giá vốn trung bình" type="number" value={ingredientForm.averageCost} onChange={(event) => setIngredientForm((current) => ({ ...current, averageCost: event.target.value }))} />
          <div className="sm:tw-col-span-2"><Input label="Vị trí trong kho" value={ingredientForm.warehouseLocation} onChange={(event) => setIngredientForm((current) => ({ ...current, warehouseLocation: event.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}
