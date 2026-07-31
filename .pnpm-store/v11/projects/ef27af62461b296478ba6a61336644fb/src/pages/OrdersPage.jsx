import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, RotateCcw, Search } from "lucide-react";
import { IconButton, InputAdornment } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage, downloadFile } from "../services/api";
import { getSocket } from "../services/socket";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import EmptyState from "../components/common/EmptyState";
import Input from "../components/common/Input";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import StatusBadge from "../components/common/StatusBadge";
import { orderTransitions } from "../constants/app";
import { formatDate, formatMoney, orderStatusLabels, paymentMethodLabels, todayInput } from "../utils/format";
import { useAuth } from "../store/AuthContext";

const statusOptions = Object.entries(orderStatusLabels).map(([value, label]) => ({ value, label }));

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("orders.manage");
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    paymentMethod: "",
    dateFrom: todayInput(),
    dateTo: todayInput(),
  });
  const [selectedId, setSelectedId] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusNote, setStatusNote] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: 0, method: "CASH", reason: "" });

  const ordersQuery = useQuery({
    queryKey: ["orders", filters],
    queryFn: () =>
      api
        .get("/orders", {
          params: {
            ...filters,
            status: filters.status || undefined,
            paymentMethod: filters.paymentMethod || undefined,
          },
        })
        .then((response) => response.data),
  });
  const detailQuery = useQuery({
    queryKey: ["order", selectedId],
    queryFn: () => api.get(`/orders/${selectedId}`).then((response) => response.data.data),
    enabled: Boolean(selectedId),
  });
  const order = detailQuery.data;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const update = (payload) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (payload?.id === selectedId || payload?.orderId === selectedId) {
        queryClient.invalidateQueries({ queryKey: ["order", selectedId] });
      }
    };
    socket.on("order:created", update);
    socket.on("order:updated", update);
    socket.on("order:refunded", update);
    return () => {
      socket.off("order:created", update);
      socket.off("order:updated", update);
      socket.off("order:refunded", update);
    };
  }, [queryClient, selectedId]);

  const statusMutation = useMutation({
    mutationFn: () => api.patch(`/orders/${order.id}/status`, { status: statusTarget, note: statusNote || null }),
    onSuccess: () => {
      toast.success("Đã cập nhật trạng thái đơn");
      setStatusTarget(null);
      setStatusNote("");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedId] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const refundMutation = useMutation({
    mutationFn: () => api.post(`/orders/${order.id}/refunds`, refundForm),
    onSuccess: () => {
      toast.success("Hoàn tiền thành công");
      setRefundOpen(false);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedId] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const columns = [
    { key: "code", label: "Mã đơn", render: (value, row) => <div><strong>{value}</strong><div className="tw-text-xs tw-text-slate-400">{formatDate(row.createdAt, true)}</div></div> },
    { key: "customer", label: "Khách hàng", render: (value) => value ? <div><strong className="tw-block tw-text-sm">{value.fullName}</strong><span className="tw-text-xs tw-text-slate-400">{value.phone}</span></div> : "Khách lẻ" },
    { key: "createdBy", label: "Nhân viên", render: (value) => value.fullName },
    { key: "totalAmount", label: "Tổng tiền", align: "right", render: (value) => <strong>{formatMoney(value)}</strong> },
    { key: "paymentStatus", label: "Thanh toán", render: (value) => <StatusBadge status={value} label={{ PAID: "Đã thanh toán", UNPAID: "Chưa thanh toán", REFUNDED: "Đã hoàn", PARTIALLY_REFUNDED: "Hoàn một phần", PARTIALLY_PAID: "Thanh toán một phần" }[value]} /> },
    { key: "status", label: "Trạng thái", render: (value) => <StatusBadge status={value} label={orderStatusLabels[value]} /> },
    { key: "actions", label: "", align: "right", render: (_, row) => <IconButton onClick={() => setSelectedId(row.id)} aria-label="Xem đơn"><Eye size={18} /></IconButton> },
  ];

  const refunded = order?.refunds?.reduce((sum, item) => item.status === "COMPLETED" ? sum + item.amount : sum, 0) || 0;
  const refundable = Math.max(0, (order?.totalAmount || 0) - refunded);

  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Vận hành theo thời gian thực"
        title="Đơn hàng"
        description="Theo dõi trạng thái làm kem, thanh toán, lịch sử xử lý và hoàn tiền."
      />
      <div className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-grid-cols-2 xl:tw-grid-cols-5 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <Input
          placeholder="Mã đơn hoặc SĐT..."
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }}
        />
        <Select label="Trạng thái" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} options={[{ value: "", label: "Tất cả trạng thái" }, ...statusOptions]} />
        <Select label="Thanh toán" value={filters.paymentMethod} onChange={(event) => setFilters((current) => ({ ...current, paymentMethod: event.target.value }))} options={[{ value: "", label: "Mọi phương thức" }, ...Object.entries(paymentMethodLabels).filter(([value]) => value !== "MIXED").map(([value, label]) => ({ value, label }))]} />
        <Input label="Từ ngày" type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} InputLabelProps={{ shrink: true }} />
        <Input label="Đến ngày" type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} InputLabelProps={{ shrink: true }} />
      </div>
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <DataTable columns={columns} rows={ordersQuery.data?.data || []} loading={ordersQuery.isLoading} />
      </div>

      <Modal
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={order ? `Chi tiết ${order.code}` : "Chi tiết đơn hàng"}
        maxWidth="md"
        actions={order && (
          <>
            <Button variant="outlined" startIcon={<Download size={17} />} onClick={() => downloadFile(`/orders/${order.id}/invoice.pdf`, `${order.code}.pdf`)}>Hóa đơn PDF</Button>
            {canManage && refundable > 0 && order.paymentStatus !== "UNPAID" && (
              <Button variant="outlined" color="warning" startIcon={<RotateCcw size={17} />} onClick={() => { setRefundForm({ amount: refundable, method: order.payments[0]?.method || "CASH", reason: "" }); setRefundOpen(true); }}>Hoàn tiền</Button>
            )}
          </>
        )}
      >
        {detailQuery.isLoading ? <LoadingSkeleton rows={6} /> : !order ? <EmptyState /> : (
          <div className="tw-space-y-5">
            <div className="tw-grid tw-gap-3 sm:tw-grid-cols-3">
              <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800"><span className="tw-text-xs tw-text-slate-400">Trạng thái</span><div className="tw-mt-2"><StatusBadge status={order.status} label={orderStatusLabels[order.status]} /></div></div>
              <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800"><span className="tw-text-xs tw-text-slate-400">Chi nhánh</span><strong className="tw-mt-1 tw-block tw-text-sm">{order.branch.name}</strong></div>
              <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800"><span className="tw-text-xs tw-text-slate-400">Khách hàng</span><strong className="tw-mt-1 tw-block tw-text-sm">{order.customer?.fullName || "Khách lẻ"}</strong></div>
            </div>
            <div className="tw-space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="tw-flex tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-100 tw-p-3 dark:tw-border-slate-700">
                  <div className="tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-xl tw-bg-mint-50">🍨</div>
                  <div className="tw-flex-1">
                    <div className="tw-flex tw-justify-between tw-gap-3"><strong>{item.productName} · {item.variantName}</strong><strong>{formatMoney(item.lineTotal)}</strong></div>
                    <div className="tw-mt-1 tw-text-xs tw-text-slate-400">
                      {item.flavors.map((value) => value.flavor.name).join(", ")}
                      {item.toppings.length ? ` · ${item.toppings.map((value) => value.topping.name).join(", ")}` : ""}
                      {` · SL ${item.quantity}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="tw-ml-auto tw-max-w-sm tw-space-y-2 tw-text-sm">
              <div className="tw-flex tw-justify-between"><span>Tạm tính</span><span>{formatMoney(order.originalAmount)}</span></div>
              <div className="tw-flex tw-justify-between"><span>Giảm giá</span><span>-{formatMoney(order.discountAmount + (order.voucherDiscount || 0) + (order.pointsDiscount || 0) + (order.membershipDiscount || 0))}</span></div>
              <div className="tw-flex tw-justify-between"><span>VAT</span><span>{formatMoney(order.taxAmount)}</span></div>
              <div className="tw-flex tw-justify-between tw-border-t tw-pt-2 tw-text-lg tw-font-black"><span>Tổng cộng</span><span>{formatMoney(order.totalAmount)}</span></div>
            </div>
            {canManage && orderTransitions[order.status].length > 0 && (
              <div>
                <h4 className="tw-mb-2 tw-text-sm tw-font-black">Cập nhật trạng thái</h4>
                <div className="tw-flex tw-flex-wrap tw-gap-2">
                  {orderTransitions[order.status].map((status) => (
                    <Button key={status} variant={status === "CANCELLED" ? "outlined" : "contained"} color={status === "CANCELLED" ? "error" : "primary"} onClick={() => setStatusTarget(status)}>
                      {orderStatusLabels[status]}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h4 className="tw-mb-3 tw-text-sm tw-font-black">Lịch sử trạng thái</h4>
              <div className="tw-space-y-3 tw-border-l-2 tw-border-mint-200 tw-pl-4">
                {order.statusHistory.map((history) => (
                  <div key={history.id}>
                    <div className="tw-flex tw-items-center tw-gap-2"><StatusBadge status={history.status} label={orderStatusLabels[history.status]} /><span className="tw-text-xs tw-text-slate-400">{formatDate(history.createdAt, true)}</span></div>
                    <div className="tw-mt-1 tw-text-xs tw-text-slate-500">{history.changedBy.fullName}{history.note ? ` · ${history.note}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={`Chuyển sang "${orderStatusLabels[statusTarget]}"?`}
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setStatusTarget(null)}>Hủy</Button>
            <Button color={statusTarget === "CANCELLED" ? "error" : "primary"} loading={statusMutation.isPending} onClick={() => statusMutation.mutate()}>Xác nhận</Button>
          </>
        }
      >
        <Input label={statusTarget === "CANCELLED" ? "Lý do hủy (bắt buộc)" : "Ghi chú"} multiline rows={3} value={statusNote} onChange={(event) => setStatusNote(event.target.value)} />
      </Modal>

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Hoàn tiền đơn hàng"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setRefundOpen(false)}>Hủy</Button>
            <Button color="warning" loading={refundMutation.isPending} disabled={!refundForm.reason.trim() || refundForm.amount <= 0} onClick={() => refundMutation.mutate()}>Xác nhận hoàn</Button>
          </>
        }
      >
        <div className="tw-space-y-4 tw-pt-2">
          <Input label={`Số tiền hoàn (tối đa ${formatMoney(refundable)})`} type="number" value={refundForm.amount} onChange={(event) => setRefundForm((current) => ({ ...current, amount: Math.min(refundable, Math.max(0, Number(event.target.value))) }))} />
          <Select label="Phương thức hoàn" value={refundForm.method} onChange={(event) => setRefundForm((current) => ({ ...current, method: event.target.value }))} options={Object.entries(paymentMethodLabels).filter(([value]) => value !== "MIXED").map(([value, label]) => ({ value, label }))} />
          <Input label="Lý do hoàn tiền" multiline rows={3} value={refundForm.reason} onChange={(event) => setRefundForm((current) => ({ ...current, reason: event.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
