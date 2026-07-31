import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ClipboardCheck,
  History,
  PackageMinus,
  PackagePlus,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
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
];

const transactionTypeLabels = {
  IMPORT: "Nhập kho",
  SALE: "Bán hàng",
  ADJUST_IN: "Điều chỉnh tăng",
  ADJUST_OUT: "Xuất kho",
  TRANSFER_IN: "Nhận chuyển kho",
  TRANSFER_OUT: "Chuyển kho đi",
  WASTE: "Xuất hủy / hao hụt",
  STOCKTAKE: "Kiểm kho",
  REFUND: "Hoàn kho",
};

const issueReasons = [
  { value: "INTERNAL_USE", label: "Sử dụng nội bộ" },
  { value: "DAMAGED", label: "Hư hỏng" },
  { value: "EXPIRED", label: "Hết hạn" },
  { value: "SAMPLE", label: "Dùng thử / mẫu" },
  { value: "OTHER", label: "Lý do khác" },
];

const emptyIssueForm = {
  reason: "INTERNAL_USE",
  note: "",
  items: [{ ingredientId: "", quantity: 1 }],
};

export default function InventoryPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission("inventory.manage");
  const isAdmin = user.role.code === "ADMIN";
  const canSelectBranch = ["ADMIN", "MANAGER"].includes(user.role.code);
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState(user.branch?.id || "");
  const [search, setSearch] = useState("");
  const [adjusting, setAdjusting] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: "ADJUST_IN", quantity: 0, note: "" });
  const [ingredientOpen, setIngredientOpen] = useState(false);
  const [ingredientForm, setIngredientForm] = useState({ code: "", name: "", unit: "g", minStock: 0, lastCost: 0, averageCost: 0, warehouseLocation: "" });
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState(emptyIssueForm);
  const [stocktakeOpen, setStocktakeOpen] = useState(false);
  const [stocktakeNote, setStocktakeNote] = useState("");
  const [stocktakeSearch, setStocktakeSearch] = useState("");
  const [stocktakeItems, setStocktakeItems] = useState([]);

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches").then((response) => response.data.data),
  });

  useEffect(() => {
    const branches = branchesQuery.data || [];
    if (!isAdmin && !branchId && branches.length) {
      setBranchId(user.branch?.id || branches[0].id);
    }
  }, [branchId, branchesQuery.data, isAdmin, user.branch?.id]);

  const inventoryQuery = useQuery({
    queryKey: ["inventory", branchId, search],
    queryFn: () => api.get("/inventory", { params: { branchId, search, size: 100 } }).then((response) => response.data.data),
    enabled: isAdmin || Boolean(branchId),
  });
  const alertsQuery = useQuery({
    queryKey: ["inventory-alerts", branchId],
    queryFn: () => api.get("/inventory/alerts", { params: { branchId } }).then((response) => response.data.data),
    enabled: isAdmin || Boolean(branchId),
  });
  const transactionsQuery = useQuery({
    queryKey: ["inventory-transactions", branchId],
    queryFn: () => api.get("/inventory/transactions", { params: { branchId, size: 20 } }).then((response) => response.data.data),
    enabled: isAdmin || Boolean(branchId),
  });
  const issuesQuery = useQuery({
    queryKey: ["stock-issues", branchId],
    queryFn: () => api.get("/inventory/issues", { params: { branchId, size: 5 } }).then((response) => response.data.data),
    enabled: isAdmin || Boolean(branchId),
  });
  const stocktakesQuery = useQuery({
    queryKey: ["stocktakes", branchId],
    queryFn: () => api.get("/inventory/stocktakes", { params: { branchId, size: 5 } }).then((response) => response.data.data),
    enabled: isAdmin || Boolean(branchId),
  });

  const refreshInventory = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["stock-issues"] });
    queryClient.invalidateQueries({ queryKey: ["stocktakes"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const adjustMutation = useMutation({
    mutationFn: () => api.post("/inventory/adjust", {
      branchId: adjusting.branchId,
      ingredientId: adjusting.ingredientId,
      ...adjustForm,
      quantity: Number(adjustForm.quantity),
    }),
    onSuccess: () => {
      toast.success("Đã cập nhật tồn kho");
      setAdjusting(null);
      setAdjustForm({ type: "ADJUST_IN", quantity: 0, note: "" });
      refreshInventory();
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
  const issueMutation = useMutation({
    mutationFn: () => api.post("/inventory/issues", {
      branchId,
      reason: issueForm.reason,
      note: issueForm.note.trim() || null,
      items: issueForm.items.map((item) => ({
        ingredientId: item.ingredientId,
        quantity: Number(item.quantity),
      })),
    }),
    onSuccess: (response) => {
      toast.success(`Đã lập phiếu xuất ${response.data.data.code}`);
      setIssueOpen(false);
      setIssueForm(emptyIssueForm);
      refreshInventory();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const stocktakeMutation = useMutation({
    mutationFn: () => api.post("/inventory/stocktakes", {
      branchId,
      note: stocktakeNote.trim() || null,
      items: stocktakeItems.map((item) => ({
        ingredientId: item.ingredientId,
        actualQuantity: Number(item.actualQuantity),
      })),
    }),
    onSuccess: (response) => {
      toast.success(`Đã hoàn tất kiểm kho ${response.data.data.code}`);
      setStocktakeOpen(false);
      setStocktakeItems([]);
      setStocktakeNote("");
      setStocktakeSearch("");
      refreshInventory();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const inventoryRows = inventoryQuery.data || [];
  const inventoryByIngredient = new Map(
    inventoryRows.map((item) => [item.ingredientId, item]),
  );
  const issueIds = issueForm.items.map((item) => item.ingredientId).filter(Boolean);
  const issueValid =
    Boolean(branchId) &&
    issueForm.items.length > 0 &&
    new Set(issueIds).size === issueForm.items.length &&
    issueForm.items.every((item) => {
      const inventory = inventoryByIngredient.get(item.ingredientId);
      return inventory && Number(item.quantity) > 0 && Number(item.quantity) <= inventory.quantity;
    }) &&
    (issueForm.reason !== "OTHER" || issueForm.note.trim().length >= 3);
  const stocktakeDifferenceCount = stocktakeItems.filter(
    (item) => Number(item.actualQuantity) !== Number(item.systemQuantity),
  ).length;
  const stocktakeValid =
    Boolean(branchId) &&
    stocktakeItems.length > 0 &&
    stocktakeItems.every(
      (item) =>
        item.actualQuantity !== "" &&
        Number.isFinite(Number(item.actualQuantity)) &&
        Number(item.actualQuantity) >= 0,
    );
  const filteredStocktakeItems = stocktakeItems.filter((item) => {
    const keyword = stocktakeSearch.trim().toLowerCase();
    return !keyword ||
      item.ingredient.name.toLowerCase().includes(keyword) ||
      item.ingredient.code.toLowerCase().includes(keyword);
  });

  const openStocktake = () => {
    setStocktakeItems(inventoryRows.map((item) => ({
      ingredientId: item.ingredientId,
      ingredient: item.ingredient,
      systemQuantity: item.quantity,
      actualQuantity: item.quantity,
    })));
    setStocktakeNote("");
    setStocktakeSearch("");
    setStocktakeOpen(true);
  };

  const addIssueLine = () => {
    const used = new Set(issueForm.items.map((item) => item.ingredientId));
    const next = inventoryRows.find((item) => !used.has(item.ingredientId));
    setIssueForm((current) => ({
      ...current,
      items: [...current.items, { ingredientId: next?.ingredientId || "", quantity: 1 }],
    }));
  };

  const columns = [
    ...(isAdmin ? [{ key: "branch", label: "Chi nhánh", render: (value) => value.name }] : []),
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
    { key: "type", label: "Loại", render: (value) => transactionTypeLabels[value] || value },
    { key: "quantity", label: "Biến động", align: "right", render: (value, row) => <strong className={value >= 0 ? "tw-text-emerald-600" : "tw-text-rose-500"}>{value >= 0 ? "+" : ""}{value.toLocaleString("vi-VN")} {row.ingredient.unit}</strong> },
    { key: "balanceAfter", label: "Sau giao dịch", align: "right", render: (value, row) => `${value.toLocaleString("vi-VN")} ${row.ingredient.unit}` },
    { key: "createdBy", label: "Người thực hiện", render: (value) => value.fullName },
  ];

  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Định lượng & lô hàng"
        title="Kho nguyên liệu"
        description="Xuất kho, kiểm đếm thực tế và theo dõi đầy đủ biến động theo từng lô."
        actions={canManage && (
          <div className="tw-flex tw-flex-wrap tw-gap-2">
            <Button
              variant="outlined"
              color="warning"
              startIcon={<PackageMinus size={18} />}
              disabled={!branchId || !inventoryRows.length}
              onClick={() => {
                setIssueForm(emptyIssueForm);
                setIssueOpen(true);
              }}
            >
              Xuất kho
            </Button>
            <Button
              variant="outlined"
              startIcon={<ClipboardCheck size={18} />}
              disabled={!branchId || !inventoryRows.length}
              onClick={openStocktake}
            >
              Kiểm kho
            </Button>
            <Button startIcon={<PackagePlus size={18} />} onClick={() => setIngredientOpen(true)}>
              Thêm nguyên liệu
            </Button>
          </div>
        )}
      />
      <div className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-grid-cols-2 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <Select
          label="Chi nhánh"
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
          options={[
            ...(isAdmin ? [{ value: "", label: "Tất cả chi nhánh" }] : []),
            ...(branchesQuery.data || []).map((branch) => ({ value: branch.id, label: branch.name })),
          ]}
          disabled={!canSelectBranch}
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
      <div className="tw-grid tw-gap-4 xl:tw-grid-cols-2">
        <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-5 dark:tw-border-slate-700 dark:tw-bg-slate-900">
          <div className="tw-mb-4 tw-flex tw-items-center tw-justify-between">
            <div>
              <h3 className="tw-m-0 tw-flex tw-items-center tw-gap-2 tw-text-base tw-font-black">
                <PackageMinus size={19} className="tw-text-amber-600" /> Phiếu xuất gần đây
              </h3>
              <p className="tw-mb-0 tw-mt-1 tw-text-xs tw-text-slate-400">Giá vốn được lấy theo lô xuất thực tế.</p>
            </div>
          </div>
          <div className="tw-space-y-2">
            {issuesQuery.data?.length ? issuesQuery.data.map((issue) => (
              <div key={issue.id} className="tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800">
                <div className="tw-flex tw-h-9 tw-w-9 tw-items-center tw-justify-center tw-rounded-lg tw-bg-amber-100 tw-text-amber-700 dark:tw-bg-amber-500/15 dark:tw-text-amber-300">
                  <PackageMinus size={17} />
                </div>
                <div className="tw-min-w-0 tw-flex-1">
                  <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-x-2">
                    <strong className="tw-text-sm">{issue.code}</strong>
                    <span className="tw-text-[11px] tw-text-slate-400">{formatDate(issue.createdAt, true)}</span>
                  </div>
                  <div className="tw-mt-0.5 tw-text-xs tw-text-slate-500">
                    {issueReasons.find((item) => item.value === issue.reason)?.label || issue.reason} · {issue.items.length} nguyên liệu
                  </div>
                </div>
                <strong className="tw-text-xs tw-text-slate-600 dark:tw-text-slate-300">{formatMoney(issue.totalCost)}</strong>
              </div>
            )) : (
              <div className="tw-rounded-xl tw-border tw-border-dashed tw-border-slate-200 tw-p-5 tw-text-center tw-text-sm tw-text-slate-400 dark:tw-border-slate-700">
                Chưa có phiếu xuất kho.
              </div>
            )}
          </div>
        </section>
        <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-5 dark:tw-border-slate-700 dark:tw-bg-slate-900">
          <div className="tw-mb-4">
            <h3 className="tw-m-0 tw-flex tw-items-center tw-gap-2 tw-text-base tw-font-black">
              <ClipboardCheck size={19} className="tw-text-mint-600" /> Lần kiểm kho gần đây
            </h3>
            <p className="tw-mb-0 tw-mt-1 tw-text-xs tw-text-slate-400">Lưu số hệ thống, số thực tế và chênh lệch từng nguyên liệu.</p>
          </div>
          <div className="tw-space-y-2">
            {stocktakesQuery.data?.length ? stocktakesQuery.data.map((stocktake) => {
              const changed = stocktake.items.filter((item) => item.difference !== 0).length;
              return (
                <div key={stocktake.id} className="tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800">
                  <div className="tw-flex tw-h-9 tw-w-9 tw-items-center tw-justify-center tw-rounded-lg tw-bg-mint-100 tw-text-mint-700 dark:tw-bg-mint-500/15 dark:tw-text-mint-300">
                    <ClipboardCheck size={17} />
                  </div>
                  <div className="tw-min-w-0 tw-flex-1">
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-x-2">
                      <strong className="tw-text-sm">{stocktake.code}</strong>
                      <span className="tw-text-[11px] tw-text-slate-400">{formatDate(stocktake.createdAt, true)}</span>
                    </div>
                    <div className="tw-mt-0.5 tw-text-xs tw-text-slate-500">
                      Đã đếm {stocktake.items.length} · {changed} nguyên liệu chênh lệch
                    </div>
                  </div>
                  <strong className={stocktake.totalVarianceCost >= 0 ? "tw-text-xs tw-text-emerald-600" : "tw-text-xs tw-text-rose-500"}>
                    {stocktake.totalVarianceCost >= 0 ? "+" : ""}{formatMoney(stocktake.totalVarianceCost)}
                  </strong>
                </div>
              );
            }) : (
              <div className="tw-rounded-xl tw-border tw-border-dashed tw-border-slate-200 tw-p-5 tw-text-center tw-text-sm tw-text-slate-400 dark:tw-border-slate-700">
                Chưa có biên bản kiểm kho.
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <h3 className="tw-mb-4 tw-mt-1 tw-flex tw-items-center tw-gap-2 tw-text-lg tw-font-black"><History size={20} /> Biến động gần đây</h3>
        <DataTable columns={transactionColumns} rows={transactionsQuery.data || []} loading={transactionsQuery.isLoading} />
      </div>

      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Lập phiếu xuất kho"
        maxWidth="md"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setIssueOpen(false)}>Hủy</Button>
            <Button
              color="warning"
              startIcon={<PackageMinus size={17} />}
              loading={issueMutation.isPending}
              disabled={!issueValid}
              onClick={() => issueMutation.mutate()}
            >
              Xác nhận xuất kho
            </Button>
          </>
        }
      >
        <div className="tw-space-y-5 tw-pt-2">
          <div className="tw-flex tw-items-start tw-gap-3 tw-rounded-2xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-p-4 dark:tw-border-amber-800 dark:tw-bg-amber-900/15">
            <PackageMinus size={20} className="tw-mt-0.5 tw-shrink-0 tw-text-amber-700" />
            <div>
              <strong className="tw-text-sm tw-text-amber-800 dark:tw-text-amber-200">Xuất kho sẽ trừ tồn ngay</strong>
              <p className="tw-mb-0 tw-mt-1 tw-text-xs tw-leading-5 tw-text-amber-700/80 dark:tw-text-amber-200/70">
                Hệ thống tự lấy lô gần hết hạn trước, ghi giá vốn thực tế và không cho số lượng tồn xuống âm.
              </p>
            </div>
          </div>
          <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
            <Select
              label="Lý do xuất kho"
              value={issueForm.reason}
              options={issueReasons}
              onChange={(event) => setIssueForm((current) => ({ ...current, reason: event.target.value }))}
            />
            <div className="tw-rounded-xl tw-bg-slate-50 tw-px-4 tw-py-2.5 tw-text-xs tw-text-slate-500 dark:tw-bg-slate-800">
              Chi nhánh
              <div className="tw-mt-1 tw-truncate tw-text-sm tw-font-bold tw-text-slate-800 dark:tw-text-slate-100">
                {(branchesQuery.data || []).find((branch) => branch.id === branchId)?.name || user.branch?.name}
              </div>
            </div>
          </div>
          <div>
            <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between tw-gap-3">
              <div>
                <h4 className="tw-m-0 tw-text-sm tw-font-black">Nguyên liệu xuất</h4>
                <p className="tw-mb-0 tw-mt-0.5 tw-text-xs tw-text-slate-400">Mỗi nguyên liệu chỉ được chọn một lần.</p>
              </div>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Plus size={15} />}
                disabled={issueForm.items.length >= inventoryRows.length}
                onClick={addIssueLine}
              >
                Thêm dòng
              </Button>
            </div>
            <div className="tw-space-y-3">
              {issueForm.items.map((line, index) => {
                const selectedInventory = inventoryByIngredient.get(line.ingredientId);
                const remaining = selectedInventory
                  ? selectedInventory.quantity - Number(line.quantity || 0)
                  : null;
                return (
                  <div key={`${index}-${line.ingredientId}`} className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-p-3 sm:tw-grid-cols-[minmax(0,1fr)_150px_42px] dark:tw-border-slate-700">
                    <Select
                      label={`Nguyên liệu ${index + 1}`}
                      value={line.ingredientId}
                      options={inventoryRows
                        .filter((item) => item.ingredientId === line.ingredientId || !issueIds.includes(item.ingredientId))
                        .map((item) => ({
                          value: item.ingredientId,
                          label: `${item.ingredient.name} · Còn ${item.quantity.toLocaleString("vi-VN")} ${item.ingredient.unit}`,
                        }))}
                      onChange={(event) => setIssueForm((current) => ({
                        ...current,
                        items: current.items.map((item, itemIndex) => itemIndex === index
                          ? { ...item, ingredientId: event.target.value, quantity: 1 }
                          : item),
                      }))}
                    />
                    <Input
                      label={`Số lượng${selectedInventory ? ` (${selectedInventory.ingredient.unit})` : ""}`}
                      type="number"
                      value={line.quantity}
                      inputProps={{ min: 0.001, step: 0.001 }}
                      error={selectedInventory && Number(line.quantity) > selectedInventory.quantity
                        ? { message: "Vượt tồn kho" }
                        : undefined}
                      helperText={selectedInventory && remaining >= 0
                        ? `Còn lại ${remaining.toLocaleString("vi-VN")} ${selectedInventory.ingredient.unit}`
                        : undefined}
                      onChange={(event) => setIssueForm((current) => ({
                        ...current,
                        items: current.items.map((item, itemIndex) => itemIndex === index
                          ? { ...item, quantity: event.target.value }
                          : item),
                      }))}
                    />
                    <button
                      type="button"
                      className="tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-self-start tw-rounded-xl tw-border-0 tw-bg-rose-50 tw-text-rose-500 tw-transition hover:tw-bg-rose-100 disabled:tw-cursor-not-allowed disabled:tw-opacity-40 dark:tw-bg-rose-500/10"
                      disabled={issueForm.items.length === 1}
                      aria-label={`Xóa dòng ${index + 1}`}
                      onClick={() => setIssueForm((current) => ({
                        ...current,
                        items: current.items.filter((_, itemIndex) => itemIndex !== index),
                      }))}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <Input
            label={issueForm.reason === "OTHER" ? "Lý do xuất kho *" : "Ghi chú"}
            multiline
            rows={3}
            value={issueForm.note}
            helperText={issueForm.reason === "OTHER" ? "Bắt buộc nhập ít nhất 3 ký tự." : "Có thể ghi người nhận hoặc mục đích sử dụng."}
            onChange={(event) => setIssueForm((current) => ({ ...current, note: event.target.value }))}
          />
        </div>
      </Modal>

      <Modal
        open={stocktakeOpen}
        onClose={() => setStocktakeOpen(false)}
        title="Kiểm kho thực tế"
        maxWidth="md"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setStocktakeOpen(false)}>Hủy</Button>
            <Button
              startIcon={<ClipboardCheck size={17} />}
              loading={stocktakeMutation.isPending}
              disabled={!stocktakeValid}
              onClick={() => stocktakeMutation.mutate()}
            >
              Hoàn tất kiểm kho
            </Button>
          </>
        }
      >
        <div className="tw-space-y-4 tw-pt-2">
          <div className="tw-grid tw-gap-3 sm:tw-grid-cols-3">
            <div className="tw-rounded-xl tw-bg-mint-50 tw-p-3 dark:tw-bg-mint-500/10">
              <div className="tw-text-[10px] tw-font-bold tw-uppercase tw-text-mint-700 dark:tw-text-mint-300">Cần kiểm đếm</div>
              <strong className="tw-mt-1 tw-block tw-text-xl">{stocktakeItems.length}</strong>
            </div>
            <div className="tw-rounded-xl tw-bg-amber-50 tw-p-3 dark:tw-bg-amber-500/10">
              <div className="tw-text-[10px] tw-font-bold tw-uppercase tw-text-amber-700 dark:tw-text-amber-300">Có chênh lệch</div>
              <strong className="tw-mt-1 tw-block tw-text-xl">{stocktakeDifferenceCount}</strong>
            </div>
            <div className="tw-rounded-xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800">
              <div className="tw-text-[10px] tw-font-bold tw-uppercase tw-text-slate-500">Chi nhánh</div>
              <strong className="tw-mt-1 tw-block tw-truncate tw-text-sm">
                {(branchesQuery.data || []).find((branch) => branch.id === branchId)?.name || user.branch?.name}
              </strong>
            </div>
          </div>
          <Input
            placeholder="Tìm nguyên liệu trong danh sách kiểm..."
            value={stocktakeSearch}
            onChange={(event) => setStocktakeSearch(event.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={17} /></InputAdornment> }}
          />
          <div className="soft-scrollbar tw-overflow-x-auto">
            <div className="tw-min-w-[640px]">
              <div className="tw-grid tw-grid-cols-[minmax(0,1fr)_110px_140px_90px] tw-gap-3 tw-rounded-xl tw-bg-slate-100 tw-px-3 tw-py-2 tw-text-[10px] tw-font-bold tw-uppercase tw-tracking-wide tw-text-slate-500 dark:tw-bg-slate-800">
                <span>Nguyên liệu</span>
                <span className="tw-text-right">Hệ thống</span>
                <span className="tw-text-right">Thực tế</span>
                <span className="tw-text-right">Lệch</span>
              </div>
              <div className="soft-scrollbar tw-mt-2 tw-max-h-[390px] tw-space-y-2 tw-overflow-y-auto tw-pr-1">
                {filteredStocktakeItems.map((item) => {
                  const difference = Number(item.actualQuantity || 0) - Number(item.systemQuantity);
                  return (
                    <div key={item.ingredientId} className="tw-grid tw-grid-cols-[minmax(0,1fr)_110px_140px_90px] tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-slate-200 tw-p-3 dark:tw-border-slate-700">
                      <div className="tw-min-w-0">
                        <strong className="tw-block tw-truncate tw-text-sm">{item.ingredient.name}</strong>
                        <span className="tw-text-[11px] tw-text-slate-400">{item.ingredient.code} · {item.ingredient.unit}</span>
                      </div>
                      <strong className="tw-text-right tw-text-sm">{Number(item.systemQuantity).toLocaleString("vi-VN")}</strong>
                      <Input
                        type="number"
                        value={item.actualQuantity}
                        inputProps={{ min: 0, step: 0.001, "aria-label": `Số thực tế ${item.ingredient.name}` }}
                        onChange={(event) => setStocktakeItems((current) => current.map((value) => value.ingredientId === item.ingredientId
                          ? { ...value, actualQuantity: event.target.value }
                          : value))}
                      />
                      <strong className={`tw-text-right tw-text-sm ${
                        difference > 0 ? "tw-text-emerald-600" : difference < 0 ? "tw-text-rose-500" : "tw-text-slate-400"
                      }`}>
                        {difference > 0 ? "+" : ""}{difference.toLocaleString("vi-VN")}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <Input
            label="Ghi chú kiểm kho"
            multiline
            rows={2}
            value={stocktakeNote}
            placeholder="Ví dụ: Kiểm kho cuối ca, kiểm kho định kỳ..."
            onChange={(event) => setStocktakeNote(event.target.value)}
          />
        </div>
      </Modal>

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
          <Input label="Số lượng điều chỉnh" type="number" value={adjustForm.quantity} onChange={(event) => setAdjustForm((current) => ({ ...current, quantity: event.target.value }))} />
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
