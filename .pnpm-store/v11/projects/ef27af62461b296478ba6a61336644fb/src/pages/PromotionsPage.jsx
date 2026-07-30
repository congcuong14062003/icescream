import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  CalendarClock,
  Edit3,
  Gift,
  Plus,
  Search,
  Sparkles,
  TicketCheck,
  Trash2,
} from "lucide-react";
import { IconButton, InputAdornment, Switch, Tooltip } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import ConfirmDialog from "../components/common/ConfirmDialog";
import DataTable from "../components/common/DataTable";
import Input from "../components/common/Input";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import StatusBadge from "../components/common/StatusBadge";
import PromotionFormDialog, {
  promotionTypes,
} from "../features/promotions/PromotionFormDialog";
import { formatDate, formatMoney } from "../utils/format";

const statusLabels = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Đã tắt",
  UPCOMING: "Sắp diễn ra",
  EXPIRED: "Đã hết hạn",
  EXHAUSTED: "Hết lượt",
};

const typeLabels = Object.fromEntries(
  promotionTypes.map((item) => [item.value, item.label]),
);

function promotionValue(promotion) {
  if (promotion.type === "BUY_X_GET_Y") {
    return `Mua ${promotion.buyQuantity} tặng ${promotion.getQuantity}`;
  }
  if (["PERCENT", "PRODUCT", "CATEGORY", "MEMBER"].includes(promotion.type)) {
    return `Giảm ${promotion.value}%`;
  }
  return `Giảm ${formatMoney(promotion.value)}`;
}

function promotionScope(promotion) {
  if (promotion.products.length) {
    return `${promotion.products.length} sản phẩm`;
  }
  if (promotion.categories.length) {
    return `${promotion.categories.length} danh mục`;
  }
  return "Toàn bộ sản phẩm";
}

function MetricCard({ label, value, helper, icon: Icon, tone = "mint" }) {
  const tones = {
    mint: "tw-bg-mint-50 tw-text-mint-700 dark:tw-bg-mint-500/10 dark:tw-text-mint-300",
    amber: "tw-bg-amber-50 tw-text-amber-700 dark:tw-bg-amber-500/10 dark:tw-text-amber-300",
    lavender: "tw-bg-lavender-50 tw-text-lavender-700 dark:tw-bg-lavender-500/10 dark:tw-text-lavender-300",
    blue: "tw-bg-blue-50 tw-text-blue-700 dark:tw-bg-blue-500/10 dark:tw-text-blue-300",
  };
  return (
    <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
        <div>
          <div className="tw-text-[10px] tw-font-bold tw-uppercase tw-tracking-wide tw-text-slate-400">{label}</div>
          <strong className="tw-mt-2 tw-block tw-text-2xl tw-font-extrabold">{value}</strong>
          <span className="tw-mt-1 tw-block tw-text-[11px] tw-text-slate-400">{helper}</span>
        </div>
        <span className={`tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-xl ${tones[tone]}`}>
          <Icon size={19} />
        </span>
      </div>
    </div>
  );
}

export default function PromotionsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: "", status: "", type: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const promotionsQuery = useQuery({
    queryKey: ["promotions", filters],
    queryFn: () =>
      api
        .get("/promotions", {
          params: {
            search: filters.search || undefined,
            status: filters.status || undefined,
            type: filters.type || undefined,
            size: 100,
          },
        })
        .then((response) => response.data.data),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((response) => response.data.data),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "promotion-options"],
    queryFn: () =>
      api
        .get("/products", { params: { status: "ACTIVE", size: 100 } })
        .then((response) => response.data.data),
  });

  const refreshPromotions = () => {
    queryClient.invalidateQueries({ queryKey: ["promotions"] });
    queryClient.invalidateQueries({ queryKey: ["pos-promotions"] });
    queryClient.invalidateQueries({ queryKey: ["order-quote"] });
  };

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? api.put(`/promotions/${editing.id}`, data)
        : api.post("/promotions", data),
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật chương trình ưu đãi" : "Đã tạo chương trình ưu đãi");
      setFormOpen(false);
      setEditing(null);
      refreshPromotions();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const statusMutation = useMutation({
    mutationFn: (promotion) =>
      api.patch(`/promotions/${promotion.id}/status`, {
        isActive: !promotion.isActive,
      }),
    onSuccess: (response) => {
      toast.success(response.data.message);
      setStatusTarget(null);
      refreshPromotions();
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setStatusTarget(null);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (promotion) => api.delete(`/promotions/${promotion.id}`),
    onSuccess: () => {
      toast.success("Đã xóa chương trình ưu đãi");
      setDeleteTarget(null);
      refreshPromotions();
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setDeleteTarget(null);
    },
  });

  const promotions = promotionsQuery.data || [];
  const metrics = useMemo(
    () => ({
      active: promotions.filter((item) => item.runtimeStatus === "ACTIVE").length,
      upcoming: promotions.filter((item) => item.runtimeStatus === "UPCOMING").length,
      buyGet: promotions.filter((item) => item.type === "BUY_X_GET_Y").length,
      usages: promotions.reduce((sum, item) => sum + item._count.usages, 0),
    }),
    [promotions],
  );

  const columns = [
    {
      key: "name",
      label: "Chương trình",
      render: (_, row) => (
        <div className="tw-flex tw-items-center tw-gap-3">
          <span className={`tw-flex tw-h-10 tw-w-10 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl ${
            row.type === "BUY_X_GET_Y"
              ? "tw-bg-amber-50 tw-text-amber-700 dark:tw-bg-amber-500/10 dark:tw-text-amber-300"
              : "tw-bg-mint-50 tw-text-mint-700 dark:tw-bg-mint-500/10 dark:tw-text-mint-300"
          }`}>
            {row.type === "BUY_X_GET_Y" ? <Gift size={18} /> : <BadgePercent size={18} />}
          </span>
          <div className="tw-min-w-0">
            <strong className="tw-block tw-max-w-64 tw-truncate">{row.name}</strong>
            <span className="tw-text-xs tw-font-bold tw-text-mint-700 dark:tw-text-mint-300">{row.code}</span>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      label: "Loại ưu đãi",
      render: (value, row) => (
        <div>
          <strong className="tw-block tw-text-sm">{promotionValue(row)}</strong>
          <span className="tw-text-xs tw-text-slate-400">{typeLabels[value]}</span>
        </div>
      ),
    },
    {
      key: "scope",
      label: "Phạm vi",
      render: (_, row) => (
        <div>
          <strong className="tw-block tw-text-sm">{promotionScope(row)}</strong>
          <span className="tw-text-xs tw-text-slate-400">
            {row.memberOnly ? "Chỉ khách thành viên" : "Mọi khách hàng"}
          </span>
        </div>
      ),
    },
    {
      key: "time",
      label: "Thời gian",
      render: (_, row) => (
        <div className="tw-whitespace-nowrap tw-text-xs">
          <strong className="tw-block">{formatDate(row.startAt, true)}</strong>
          <span className="tw-text-slate-400">đến {formatDate(row.endAt, true)}</span>
        </div>
      ),
    },
    {
      key: "usage",
      label: "Lượt dùng",
      align: "right",
      render: (_, row) => (
        <div className="tw-whitespace-nowrap">
          <strong>{row._count.usages.toLocaleString("vi-VN")}</strong>
          <span className="tw-text-slate-400">
            {row.totalUsageLimit ? ` / ${row.totalUsageLimit.toLocaleString("vi-VN")}` : " / Không giới hạn"}
          </span>
          <div className="tw-mt-1 tw-text-[10px] tw-text-slate-400">
            Tối đa {row.usagePerCustomer} lần/khách
          </div>
        </div>
      ),
    },
    {
      key: "runtimeStatus",
      label: "Trạng thái",
      render: (value) => <StatusBadge status={value} label={statusLabels[value]} />,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (_, row) => (
        <div className="tw-flex tw-items-center tw-justify-end tw-gap-1" onClick={(event) => event.stopPropagation()}>
          <Tooltip title="Chỉnh sửa">
            <IconButton
              size="small"
              onClick={() => {
                setEditing(row);
                setFormOpen(true);
              }}
              aria-label={`Chỉnh sửa ${row.name}`}
            >
              <Edit3 size={17} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Xóa ưu đãi chưa phát sinh giao dịch">
            <IconButton
              size="small"
              color="error"
              onClick={() => setDeleteTarget(row)}
              aria-label={`Xóa ${row.name}`}
            >
              <Trash2 size={17} />
            </IconButton>
          </Tooltip>
          <Tooltip title={row.isActive ? "Tắt ưu đãi" : "Bật ưu đãi"}>
            <Switch
              size="small"
              checked={row.isActive}
              onChange={() => setStatusTarget(row)}
              inputProps={{ "aria-label": `${row.isActive ? "Tắt" : "Bật"} ${row.name}` }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Pricing & campaigns"
        title="Quản lý chương trình ưu đãi"
        description="Tạo và điều chỉnh chương trình bán hàng. Các ưu đãi đang hoạt động được đồng bộ trực tiếp sang POS."
        actions={
          <Button
            startIcon={<Plus size={18} />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Tạo ưu đãi
          </Button>
        }
      />

      <div className="tw-grid tw-gap-3 sm:tw-grid-cols-2 xl:tw-grid-cols-4">
        <MetricCard label="Đang hoạt động" value={metrics.active} helper="Đang hiển thị hoặc dùng được tại POS" icon={TicketCheck} />
        <MetricCard label="Sắp diễn ra" value={metrics.upcoming} helper="Tự bật khi đến ngày bắt đầu" icon={CalendarClock} tone="blue" />
        <MetricCard label="Chương trình mua tặng" value={metrics.buyGet} helper="Bao gồm mua 3 tặng 1" icon={Gift} tone="amber" />
        <MetricCard label="Tổng lượt đã dùng" value={metrics.usages.toLocaleString("vi-VN")} helper="Theo các chương trình đang lọc" icon={Sparkles} tone="lavender" />
      </div>

      <div className="tw-flex tw-items-start tw-gap-3 tw-rounded-2xl tw-border tw-border-mint-200 tw-bg-mint-50 tw-p-4 dark:tw-border-mint-800 dark:tw-bg-mint-500/10">
        <Sparkles size={19} className="tw-mt-0.5 tw-shrink-0 tw-text-mint-700 dark:tw-text-mint-300" />
        <div>
          <strong className="tw-text-sm tw-text-mint-800 dark:tw-text-mint-200">Thay đổi có hiệu lực ngay</strong>
          <p className="tw-mb-0 tw-mt-1 tw-text-xs tw-leading-5 tw-text-mint-700/80 dark:tw-text-mint-300/80">
            POS luôn lấy điều kiện từ MySQL và backend tự tính lại số tiền giảm khi báo giá hoặc thanh toán.
          </p>
        </div>
      </div>

      <div className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-grid-cols-3 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <Input
          placeholder="Tìm tên hoặc mã ưu đãi..."
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }}
        />
        <Select
          label="Trạng thái"
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          options={[
            { value: "", label: "Tất cả trạng thái" },
            { value: "ACTIVE", label: "Đang hoạt động" },
            { value: "UPCOMING", label: "Sắp diễn ra" },
            { value: "INACTIVE", label: "Đã tắt" },
            { value: "EXPIRED", label: "Đã hết hạn" },
          ]}
        />
        <Select
          label="Loại ưu đãi"
          value={filters.type}
          onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
          options={[{ value: "", label: "Tất cả loại ưu đãi" }, ...promotionTypes]}
        />
      </div>

      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <DataTable
          columns={columns}
          rows={promotions}
          loading={promotionsQuery.isLoading}
          onRowClick={(row) => {
            setEditing(row);
            setFormOpen(true);
          }}
        />
      </div>

      <PromotionFormDialog
        open={formOpen}
        promotion={editing}
        products={productsQuery.data || []}
        categories={categoriesQuery.data || []}
        loading={saveMutation.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(data) => saveMutation.mutate(data)}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => statusMutation.mutate(statusTarget)}
        loading={statusMutation.isPending}
        title={statusTarget?.isActive ? "Tắt chương trình ưu đãi?" : "Bật chương trình ưu đãi?"}
        message={
          statusTarget?.isActive
            ? `${statusTarget?.name} sẽ không còn được áp dụng tại POS. Các đơn đã phát sinh vẫn giữ nguyên lịch sử.`
            : `${statusTarget?.name} sẽ được áp dụng khi đang trong thời gian hiệu lực và còn lượt sử dụng.`
        }
        confirmText={statusTarget?.isActive ? "Tắt ưu đãi" : "Bật ưu đãi"}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget)}
        loading={deleteMutation.isPending}
        title="Xóa chương trình ưu đãi?"
        message="Chỉ chương trình chưa phát sinh đơn hàng mới được xóa. Nếu đã được sử dụng, hệ thống sẽ yêu cầu tắt chương trình để giữ lịch sử."
        confirmText="Xóa ưu đãi"
      />
    </div>
  );
}
