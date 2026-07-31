import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeDollarSign, Edit3, IceCreamBowl, Search, Sparkles } from "lucide-react";
import { InputAdornment, Tab, Tabs } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage } from "../../services/api";
import Button from "../../components/common/Button";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import StatusBadge from "../../components/common/StatusBadge";
import { formatMoney } from "../../utils/format";

const MAX_PRICE = 1000000000;
const statusLabels = {
  AVAILABLE: "Đang bán",
  OUT_OF_STOCK: "Hết hàng",
  INACTIVE: "Ngừng bán",
};

function itemStatus(type, item) {
  return type === "flavor" ? item.status : item.stockStatus;
}

function itemPrice(type, item) {
  return type === "flavor" ? item.extraPrice : item.price;
}

export default function ExtraPricingDialog({ open, onClose }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState("flavor");
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [editing, setEditing] = useState(null);
  const [priceInput, setPriceInput] = useState("");

  const flavorsQuery = useQuery({
    queryKey: ["extra-pricing", "flavors"],
    queryFn: () => api.get("/flavors", { params: { size: 100 } }).then((response) => response.data.data),
    enabled: open,
  });
  const toppingsQuery = useQuery({
    queryKey: ["extra-pricing", "toppings"],
    queryFn: () => api.get("/toppings", { params: { size: 100 } }).then((response) => response.data.data),
    enabled: open,
  });

  const activeQuery = type === "flavor" ? flavorsQuery : toppingsQuery;
  const sourceItems = activeQuery.data || [];
  const rows = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("vi-VN");
    return sourceItems.filter((item) => {
      const matchesSearch = !search
        || item.name.toLocaleLowerCase("vi-VN").includes(search)
        || item.code.toLocaleLowerCase("vi-VN").includes(search);
      const matchesStatus = !filters.status || itemStatus(type, item) === filters.status;
      return matchesSearch && matchesStatus;
    });
  }, [filters, sourceItems, type]);

  const stats = useMemo(() => {
    const prices = sourceItems.map((item) => itemPrice(type, item));
    return {
      total: sourceItems.length,
      available: sourceItems.filter((item) => itemStatus(type, item) === "AVAILABLE").length,
      average: prices.length ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : 0,
    };
  }, [sourceItems, type]);

  const saveMutation = useMutation({
    mutationFn: ({ item, nextPrice, targetType }) => (
      targetType === "flavor"
        ? api.put("/flavors/" + item.id, { extraPrice: nextPrice })
        : api.put("/toppings/" + item.id, { price: nextPrice })
    ),
    onSuccess: (_, variables) => {
      toast.success(
        variables.targetType === "flavor"
          ? "Đã cập nhật phụ thu hương vị"
          : "Đã cập nhật giá bán topping",
      );
      setEditing(null);
      setPriceInput("");
      queryClient.invalidateQueries({ queryKey: ["extra-pricing", variables.targetType === "flavor" ? "flavors" : "toppings"] });
      queryClient.invalidateQueries({ queryKey: [variables.targetType === "flavor" ? "pos-flavors" : "pos-toppings"] });
      queryClient.invalidateQueries({ queryKey: ["order-quote"] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const beginEdit = (item) => {
    setEditing(item);
    setPriceInput(String(itemPrice(type, item)));
  };

  const cancelEdit = () => {
    if (saveMutation.isPending) return;
    setEditing(null);
    setPriceInput("");
  };

  const savePrice = () => {
    if (!editing) return;
    const nextPrice = Number(priceInput);
    if (!Number.isFinite(nextPrice) || !Number.isInteger(nextPrice) || nextPrice < 0 || nextPrice > MAX_PRICE) {
      return toast.error("Giá bán phải là số nguyên từ 0 đến 1.000.000.000 VNĐ");
    }
    if (nextPrice === itemPrice(type, editing)) {
      return toast.info("Giá bán chưa thay đổi");
    }
    saveMutation.mutate({ item: editing, nextPrice, targetType: type });
  };

  const changeType = (_, nextType) => {
    if (saveMutation.isPending) return;
    cancelEdit();
    setType(nextType);
    setFilters({ search: "", status: "" });
  };

  const handleClose = () => {
    if (saveMutation.isPending) return;
    cancelEdit();
    onClose();
  };

  const columns = [
    {
      key: "name",
      label: type === "flavor" ? "Hương vị" : "Topping",
      render: (_, row) => (
        <div className="tw-flex tw-min-w-[210px] tw-items-center tw-gap-3">
          <div className="tw-flex tw-h-11 tw-w-11 tw-shrink-0 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-xl tw-bg-slate-100 dark:tw-bg-slate-800">
            {row.imageUrl ? (
              <img src={row.imageUrl} alt="" className="tw-h-full tw-w-full tw-object-cover" />
            ) : type === "flavor" ? (
              <span className="tw-h-7 tw-w-7 tw-rounded-full tw-shadow-inner" style={{ backgroundColor: row.color }} />
            ) : (
              <Sparkles size={20} className="tw-text-amber-500" />
            )}
          </div>
          <div>
            <strong className="tw-block">{row.name}</strong>
            <span className="tw-text-xs tw-text-slate-400">{row.code}</span>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      label: type === "flavor" ? "Phụ thu / viên" : "Giá bán / phần",
      align: "right",
      render: (_, row) => editing?.id === row.id ? (
        <div className="tw-ml-auto tw-w-[190px]">
          <Input
            autoFocus
            size="small"
            type="number"
            value={priceInput}
            onChange={(event) => setPriceInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") savePrice();
              if (event.key === "Escape") cancelEdit();
            }}
            inputProps={{ min: 0, max: MAX_PRICE, step: 1000 }}
            InputProps={{ endAdornment: <InputAdornment position="end">VNĐ</InputAdornment> }}
          />
        </div>
      ) : <strong className="tw-text-mint-700 dark:tw-text-mint-300">{formatMoney(itemPrice(type, row))}</strong>,
    },
    ...(type === "topping" ? [{
      key: "costPrice",
      label: "Giá vốn tham khảo",
      align: "right",
      render: (value) => <span className="tw-text-slate-500">{formatMoney(value)}</span>,
    }] : []),
    {
      key: "status",
      label: "Trạng thái",
      render: (_, row) => {
        const status = itemStatus(type, row);
        return <StatusBadge status={status} label={statusLabels[status]} />;
      },
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (_, row) => editing?.id === row.id ? (
        <div className="tw-flex tw-justify-end tw-gap-2">
          <Button size="small" variant="text" color="inherit" disabled={saveMutation.isPending} onClick={cancelEdit}>Hủy</Button>
          <Button size="small" loading={saveMutation.isPending} onClick={savePrice}>Lưu giá</Button>
        </div>
      ) : (
        <Button size="small" variant="outlined" startIcon={<Edit3 size={15} />} disabled={Boolean(editing)} onClick={() => beginEdit(row)}>
          Sửa giá
        </Button>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Giá bán hương vị & topping"
      maxWidth="lg"
      actions={<Button variant="text" color="inherit" disabled={saveMutation.isPending} onClick={handleClose}>Đóng</Button>}
    >
      <div className="tw-space-y-5">
        <div className="tw-flex tw-gap-3 tw-rounded-2xl tw-border tw-border-mint-200 tw-bg-mint-50 tw-p-4 dark:tw-border-mint-800 dark:tw-bg-mint-900/20">
          <BadgeDollarSign size={21} className="tw-mt-0.5 tw-shrink-0 tw-text-mint-700 dark:tw-text-mint-300" />
          <div>
            <strong className="tw-text-sm">Giá mới áp dụng ngay cho đơn chưa thanh toán</strong>
            <p className="tw-mb-0 tw-mt-1 tw-text-xs tw-leading-5 tw-text-slate-500 dark:tw-text-slate-400">
              Backend luôn lấy giá mới nhất từ database khi tính đơn. Hóa đơn đã hoàn thành vẫn giữ nguyên giá tại thời điểm bán.
            </p>
          </div>
        </div>

        <div className="tw-overflow-hidden tw-rounded-2xl tw-border tw-border-slate-200 dark:tw-border-slate-700">
          <Tabs value={type} onChange={changeType} variant="fullWidth" aria-label="Chọn loại giá bán">
            <Tab value="flavor" icon={<IceCreamBowl size={18} />} iconPosition="start" label={"Hương vị (" + (flavorsQuery.data?.length || 0) + ")"} />
            <Tab value="topping" icon={<Sparkles size={18} />} iconPosition="start" label={"Topping (" + (toppingsQuery.data?.length || 0) + ")"} />
          </Tabs>
        </div>

        <div className="tw-grid tw-gap-3 sm:tw-grid-cols-3">
          <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-4 dark:tw-bg-slate-800">
            <span className="tw-text-xs tw-text-slate-400">Tổng cấu hình</span>
            <strong className="tw-mt-1 tw-block tw-text-xl">{stats.total}</strong>
          </div>
          <div className="tw-rounded-2xl tw-bg-emerald-50 tw-p-4 dark:tw-bg-emerald-900/20">
            <span className="tw-text-xs tw-text-slate-400">Đang bán</span>
            <strong className="tw-mt-1 tw-block tw-text-xl">{stats.available}</strong>
          </div>
          <div className="tw-rounded-2xl tw-bg-lavender-50 tw-p-4 dark:tw-bg-lavender-500/10">
            <span className="tw-text-xs tw-text-slate-400">Giá trung bình</span>
            <strong className="tw-mt-1 tw-block tw-text-xl">{formatMoney(stats.average)}</strong>
          </div>
        </div>

        <div className="tw-grid tw-gap-3 sm:tw-grid-cols-2">
          <Input
            placeholder="Tìm theo tên hoặc mã..."
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
              { value: "AVAILABLE", label: "Đang bán" },
              { value: "OUT_OF_STOCK", label: "Hết hàng" },
              { value: "INACTIVE", label: "Ngừng bán" },
            ]}
          />
        </div>

        {activeQuery.isError ? (
          <EmptyState
            title="Không tải được bảng giá"
            description={apiMessage(activeQuery.error)}
            action={<Button onClick={() => activeQuery.refetch()}>Thử lại</Button>}
          />
        ) : (
          <DataTable columns={columns} rows={rows} loading={activeQuery.isLoading} />
        )}
      </div>
    </Modal>
  );
}
