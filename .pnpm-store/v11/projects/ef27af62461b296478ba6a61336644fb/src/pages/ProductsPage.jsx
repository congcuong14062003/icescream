import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeDollarSign, BookOpen, Edit3, Plus, Search, Trash2 } from "lucide-react";
import { IconButton, InputAdornment } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import ConfirmDialog from "../components/common/ConfirmDialog";
import DataTable from "../components/common/DataTable";
import Input from "../components/common/Input";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import StatusBadge from "../components/common/StatusBadge";
import ProductFormDialog from "../features/products/ProductFormDialog";
import ExtraPricingDialog from "../features/products/ExtraPricingDialog";
import ProductRecipeDialog from "../features/products/ProductRecipeDialog";
import { formatMoney } from "../utils/format";
import { useAuth } from "../store/AuthContext";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("products.manage");
  const [filters, setFilters] = useState({ search: "", categoryId: "", status: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [recipeProductId, setRecipeProductId] = useState(null);
  const [pricingOpen, setPricingOpen] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((response) => response.data.data),
  });
  const productsQuery = useQuery({
    queryKey: ["products", filters],
    queryFn: () =>
      api
        .get("/products", {
          params: {
            ...filters,
            categoryId: filters.categoryId || undefined,
            status: filters.status || undefined,
            size: 100,
          },
        })
        .then((response) => response.data.data),
  });
  const saveMutation = useMutation({
    mutationFn: (data) => editing ? api.put(`/products/${editing.id}`, data) : api.post("/products", data),
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật sản phẩm" : "Đã tạo sản phẩm");
      setFormOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (product) => api.delete(`/products/${product.id}`),
    onSuccess: () => {
      toast.success("Đã xóa sản phẩm chưa phát sinh giao dịch");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setDeleting(null);
    },
  });

  const columns = [
    {
      key: "name",
      label: "Sản phẩm",
      render: (_, row) => (
        <div className="tw-flex tw-items-center tw-gap-3">
          <div className="tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-xl tw-bg-mint-50 tw-text-xl">
            {row.imageUrl ? <img src={row.imageUrl} alt="" className="tw-h-full tw-w-full tw-object-cover" /> : "🍨"}
          </div>
          <div><strong className="tw-block">{row.name}</strong><span className="tw-text-xs tw-text-slate-400">{row.code}</span></div>
        </div>
      ),
    },
    { key: "category", label: "Danh mục", render: (value) => value.name },
    { key: "variants", label: "Biến thể", render: (value) => `${value.filter((item) => item.isActive).length} biến thể` },
    {
      key: "price",
      label: "Giá từ",
      align: "right",
      render: (_, row) => {
        const activePrices = row.variants.filter((item) => item.isActive).map((item) => item.price);
        return <strong>{formatMoney(activePrices.length ? Math.min(...activePrices) : row.price)}</strong>;
      },
    },
    { key: "status", label: "Trạng thái", render: (value) => <StatusBadge status={value} label={{ ACTIVE: "Đang bán", INACTIVE: "Ngừng bán", OUT_OF_STOCK: "Hết hàng" }[value]} /> },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (_, row) => (
        <div className="tw-whitespace-nowrap">
          <IconButton color="primary" onClick={(event) => { event.stopPropagation(); setRecipeProductId(row.id); }} aria-label="Xem công thức nguyên liệu"><BookOpen size={17} /></IconButton>
          {canManage && (
            <>
              <IconButton onClick={(event) => { event.stopPropagation(); setEditing(row); setFormOpen(true); }} aria-label="Sửa sản phẩm"><Edit3 size={17} /></IconButton>
              <IconButton color="error" onClick={(event) => { event.stopPropagation(); setDeleting(row); }} aria-label="Xóa sản phẩm"><Trash2 size={17} /></IconButton>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Danh mục & thực đơn"
        title="Quản lý sản phẩm kem"
        description="Giá bán và biến thể tại đây được dùng trực tiếp khi backend tính tiền POS."
        actions={canManage && (
          <div className="tw-flex tw-flex-wrap tw-gap-2">
            <Button variant="outlined" startIcon={<BadgeDollarSign size={18} />} onClick={() => setPricingOpen(true)}>
              Giá hương vị & topping
            </Button>
            <Button startIcon={<Plus size={18} />} onClick={() => { setEditing(null); setFormOpen(true); }}>
              Thêm sản phẩm
            </Button>
          </div>
        )}
      />
      <div className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-grid-cols-3 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <Input
          placeholder="Tìm tên, mã hoặc SKU..."
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }}
        />
        <Select
          label="Danh mục"
          value={filters.categoryId}
          onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}
          options={[{ value: "", label: "Tất cả danh mục" }, ...(categoriesQuery.data || []).map((item) => ({ value: item.id, label: item.name }))]}
        />
        <Select
          label="Trạng thái"
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          options={[
            { value: "", label: "Tất cả trạng thái" },
            { value: "ACTIVE", label: "Đang bán" },
            { value: "INACTIVE", label: "Ngừng bán" },
            { value: "OUT_OF_STOCK", label: "Hết hàng" },
          ]}
        />
      </div>
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <DataTable columns={columns} rows={productsQuery.data || []} loading={productsQuery.isLoading} />
      </div>
      <ExtraPricingDialog open={pricingOpen} onClose={() => setPricingOpen(false)} />
      <ProductRecipeDialog
        open={Boolean(recipeProductId)}
        productId={recipeProductId}
        onClose={() => setRecipeProductId(null)}
        canManage={canManage}
      />
      <ProductFormDialog
        open={formOpen}
        product={editing}
        categories={categoriesQuery.data || []}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={(data) => saveMutation.mutate(data)}
        loading={saveMutation.isPending}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate(deleting)}
        loading={deleteMutation.isPending}
        title="Xóa sản phẩm?"
        message="Sản phẩm chưa phát sinh giao dịch sẽ được xóa mềm. Nếu đã có đơn hàng, hệ thống sẽ từ chối để giữ lịch sử."
        confirmText="Xóa sản phẩm"
      />
    </div>
  );
}
