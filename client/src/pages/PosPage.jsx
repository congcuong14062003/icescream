import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArchiveRestore,
  Banknote,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Crown,
  Gift,
  IceCreamBowl,
  Minus,
  NotebookPen,
  Pencil,
  Plus,
  Receipt,
  Save,
  Search,
  ShoppingCart,
  Sparkles,
  Smartphone,
  Trash2,
  XCircle,
} from "lucide-react";
import { Accordion, AccordionDetails, AccordionSummary, IconButton, InputAdornment } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage, downloadFile } from "../services/api";
import { getSocket } from "../services/socket";
import Button from "../components/common/Button";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";
import Input from "../components/common/Input";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import Modal from "../components/common/Modal";
import ProductCard from "../components/common/ProductCard";
import ProductCustomizer from "../features/pos/ProductCustomizer";
import CustomerPicker from "../features/pos/CustomerPicker";
import { formatDate, formatMoney, paymentMethodLabels } from "../utils/format";
import { Link } from "react-router-dom";
import { useAuth } from "../store/AuthContext";

const paymentIcons = {
  CASH: Banknote,
  BANK_TRANSFER: CircleDollarSign,
  CARD: CreditCard,
  EWALLET: Smartphone,
};

export default function PosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cart, setCart] = useState([]);
  const [editingLine, setEditingLine] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [giftVariantId, setGiftVariantId] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [orderNote, setOrderNote] = useState("");
  const [promotionInput, setPromotionInput] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [customerPaid, setCustomerPaid] = useState(0);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [restoredDraftId, setRestoredDraftId] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories", "active"],
    queryFn: () => api.get("/categories", { params: { active: true } }).then((response) => response.data.data),
  });
  const productsQuery = useQuery({
    queryKey: ["pos-products", search, categoryId],
    queryFn: () =>
      api
        .get("/products", { params: { search, categoryId: categoryId || undefined, status: "ACTIVE", size: 100 } })
        .then((response) => response.data.data),
  });
  const flavorsQuery = useQuery({
    queryKey: ["pos-flavors"],
    queryFn: () => api.get("/flavors", { params: { status: "AVAILABLE", size: 100 } }).then((response) => response.data.data),
  });
  const toppingsQuery = useQuery({
    queryKey: ["pos-toppings"],
    queryFn: () => api.get("/toppings", { params: { status: "AVAILABLE", size: 100 } }).then((response) => response.data.data),
  });
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const updateCatalogPrice = (payload) => {
      if (payload?.type === "FLAVOR") {
        queryClient.invalidateQueries({ queryKey: ["pos-flavors"] });
      }
      if (payload?.type === "TOPPING") {
        queryClient.invalidateQueries({ queryKey: ["pos-toppings"] });
      }
      queryClient.invalidateQueries({ queryKey: ["order-quote"] });
    };
    socket.on("catalog:price-updated", updateCatalogPrice);
    return () => socket.off("catalog:price-updated", updateCatalogPrice);
  }, [queryClient]);

  useEffect(() => {
    if (!productsQuery.data || !flavorsQuery.data || !toppingsQuery.data) return;
    const flavorPrices = new Map(flavorsQuery.data.map((item) => [item.id, item.extraPrice]));
    const toppingPrices = new Map(toppingsQuery.data.map((item) => [item.id, item.price]));
    setCart((current) => {
      let changed = false;
      const next = current.map((line) => {
        const product = productsQuery.data.find((item) => item.id === line.productId);
        const variant = product?.variants.find((item) => item.id === line.variantId);
        const selectedFlavorPrices = line.flavorIds.map((id) => flavorPrices.get(id));
        const selectedToppingPrices = line.toppingIds.map((id) => toppingPrices.get(id));
        if (
          !variant
          || selectedFlavorPrices.some((value) => value === undefined)
          || selectedToppingPrices.some((value) => value === undefined)
        ) {
          return line;
        }
        const nextUnitPrice = variant.price
          + selectedFlavorPrices.reduce((sum, value) => sum + value, 0)
          + selectedToppingPrices.reduce((sum, value) => sum + value, 0);
        if (nextUnitPrice === line.displayUnitPrice) return line;
        changed = true;
        return { ...line, displayUnitPrice: nextUnitPrice };
      });
      return changed ? next : current;
    });
  }, [flavorsQuery.data, productsQuery.data, toppingsQuery.data]);
  const shiftQuery = useQuery({
    queryKey: ["current-shift"],
    queryFn: () => api.get("/shifts/current").then((response) => response.data.data),
  });
  const draftsQuery = useQuery({
    queryKey: ["my-drafts"],
    queryFn: () => api.get("/orders/drafts/mine").then((response) => response.data.data),
    enabled: draftsOpen,
  });
  const promotionsQuery = useQuery({
    queryKey: ["pos-promotions"],
    queryFn: () =>
      api
        .get("/promotions", { params: { active: true, size: 20 } })
        .then((response) => response.data.data),
  });

  const orderInput = useMemo(
    () => ({
      items: cart.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        flavorIds: line.flavorIds,
        toppingIds: line.toppingIds,
        note: line.note || null,
      })),
      customerId: customer?.id || null,
      promotionCode: promotionCode || null,
      deliveryFee: Number(deliveryFee || 0),
    }),
    [cart, customer, promotionCode, deliveryFee],
  );

  const quoteQuery = useQuery({
    queryKey: ["order-quote", orderInput],
    queryFn: () => api.post("/orders/quote", orderInput).then((response) => response.data.data),
    enabled: cart.length > 0,
    placeholderData: (previous) => previous,
    retry: false,
  });
  const quote = cart.length > 0 ? quoteQuery.data : null;
  const localTotal = cart.reduce((sum, line) => sum + line.displayUnitPrice * line.quantity, 0);
  const total = quote?.totalAmount ?? localTotal;
  const change = paymentMethod === "CASH" ? Math.max(0, Number(customerPaid || 0) - total) : 0;
  const branchVouchers = (customer?.activeVouchers || []).filter(
    (voucher) => voucher.branchId === user?.branch?.id,
  );

  const saveOrderMutation = useMutation({
    mutationFn: (saveAsDraft) =>
      api.post("/orders", {
        ...orderInput,
        draftId: restoredDraftId,
        note: orderNote || null,
        saveAsDraft,
        customerPaid: saveAsDraft ? 0 : paymentMethod === "CASH" ? Number(customerPaid || 0) : total,
        payments: saveAsDraft || total === 0 ? [] : [{ method: paymentMethod, amount: total }],
      }),
    onSuccess: (response, saveAsDraft) => {
      if (saveAsDraft) toast.success("Đã lưu đơn tạm");
      else {
        toast.success("Thanh toán thành công");
        setCompletedOrder(response.data.data);
      }
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["my-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-search"] });
      queryClient.invalidateQueries({ queryKey: ["customer"] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const clearCart = () => {
    setCart([]);
    setCustomer(null);
    setOrderNote("");
    setPromotionInput("");
    setPromotionCode("");
    setDeliveryFee(0);
    setCustomerPaid(0);
    setRestoredDraftId(null);
  };
  const addOrUpdateLine = (line) => {
    setCart((current) => {
      const index = current.findIndex((item) => item.cartId === line.cartId);
      if (index === -1) return [...current, line];
      return current.map((item) => (item.cartId === line.cartId ? line : item));
    });
    setEditingLine(null);
    toast.success(editingLine ? "Đã cập nhật món" : "Đã thêm vào giỏ");
  };
  const updateQuantity = (cartId, quantity) => {
    if (quantity < 1) return;
    setCart((current) => current.map((line) => line.cartId === cartId ? { ...line, quantity } : line));
  };
  const removeLine = (cartId) => setCart((current) => current.filter((line) => line.cartId !== cartId));
  const applyPromotion = () => {
    setPromotionCode(promotionInput.trim().toUpperCase());
  };
  const selectPromotion = (promotion) => {
    const nextCode = promotionCode === promotion.code ? "" : promotion.code;
    setPromotionInput(nextCode);
    setPromotionCode(nextCode);
  };
  const restoreDraft = (draft) => {
    setCart(
      draft.items.map((item) => ({
        cartId: item.id,
        productId: item.productId,
        productName: item.productName,
        imageUrl: item.product.imageUrl,
        categoryId: item.product.categoryId,
        variantId: item.variantId,
        variantName: item.variantName,
        flavorIds: item.flavors.map((value) => value.flavorId),
        toppingIds: item.toppings.map((value) => value.toppingId),
        quantity: item.quantity,
        note: item.note || "",
        displayUnitPrice: item.unitPrice,
      })),
    );
    setCustomer(draft.customer);
    setOrderNote(draft.note || "");
    setPromotionCode(draft.promotion?.code || "");
    setPromotionInput(draft.promotion?.code || "");
    setDeliveryFee(draft.deliveryFee);
    setRestoredDraftId(draft.id);
    setDraftsOpen(false);
    toast.success(`Đã khôi phục ${draft.code}`);
  };
  const checkout = () => {
    if (!quote) return toast.error("Đang chờ hệ thống tính lại đơn hàng");
    if (quoteQuery.isError) return toast.error(apiMessage(quoteQuery.error));
    if (paymentMethod === "CASH" && Number(customerPaid || 0) < total) {
      return toast.error("Số tiền khách đưa chưa đủ");
    }
    saveOrderMutation.mutate(false);
  };

  const openEdit = (line) => {
    const product = productsQuery.data?.find((item) => item.id === line.productId);
    if (!product) return toast.error("Sản phẩm không còn trong danh sách bán");
    setGiftVariantId(null);
    setEditingLine(line);
    setSelectedProduct(product);
  };

  const addMembershipGift = async () => {
    const benefitVariant = quote?.activeMembership?.plan?.benefitVariant;
    if (!benefitVariant) {
      return toast.error("Gói hội viên chưa được cấu hình sản phẩm quà tặng");
    }
    try {
      const response = await api.get(`/products/${benefitVariant.product.id}`);
      setEditingLine(null);
      setGiftVariantId(benefitVariant.id);
      setSelectedProduct(response.data.data);
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const customizeInitial = editingLine
    ? {
        ...editingLine,
      }
    : null;

  return (
    <div className="tw-flex tw-min-h-full tw-flex-col tw-bg-[#f3f6f5] xl:tw-h-full xl:tw-flex-row dark:tw-bg-[#0b1211]">
      <section className="soft-scrollbar tw-min-w-0 tw-flex-1 tw-p-4 sm:tw-p-5 xl:tw-overflow-y-auto">
        <div className="tw-sticky tw-top-0 tw-z-20 tw-mb-5 tw-space-y-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white/95 tw-p-3.5 tw-shadow-panel tw-backdrop-blur-xl dark:tw-border-slate-700 dark:tw-bg-slate-900/95">
          <div className="tw-flex tw-flex-col tw-gap-3 sm:tw-flex-row">
            <Input
              placeholder="Tìm tên, mã sản phẩm hoặc SKU..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }}
            />
            <div className={`tw-flex tw-shrink-0 tw-items-center tw-gap-2 tw-rounded-xl tw-border tw-px-3.5 tw-py-2 tw-text-xs tw-font-bold ${
              shiftQuery.data ? "tw-border-emerald-200 tw-bg-emerald-50 tw-text-emerald-700 dark:tw-border-emerald-800 dark:tw-bg-emerald-900/20" : "tw-border-rose-200 tw-bg-rose-50 tw-text-rose-600 dark:tw-border-rose-800 dark:tw-bg-rose-900/20"
            }`}>
              <Clock3 size={17} />
              {shiftQuery.data ? `Ca ${shiftQuery.data.code}` : <Link to="/shifts" className="tw-text-inherit">Mở ca để bán hàng</Link>}
            </div>
          </div>
          <div className="no-scrollbar tw-flex tw-gap-2 tw-overflow-x-auto">
            <button
              type="button"
              onClick={() => setCategoryId("")}
              className={`tw-shrink-0 tw-rounded-lg tw-border tw-px-3.5 tw-py-2 tw-text-xs tw-font-bold tw-transition ${
                categoryId === "" ? "tw-border-mint-700 tw-bg-mint-700 tw-text-white tw-shadow-sm" : "tw-border-slate-200 tw-bg-white tw-text-slate-500 hover:tw-border-mint-300 hover:tw-text-mint-700 dark:tw-border-slate-700 dark:tw-bg-slate-800 dark:tw-text-slate-300"
              }`}
            >
              Tất cả
            </button>
            {categoriesQuery.data?.map((category) => (
              <button
                type="button"
                key={category.id}
                onClick={() => setCategoryId(category.id)}
                className={`tw-shrink-0 tw-rounded-lg tw-border tw-px-3.5 tw-py-2 tw-text-xs tw-font-bold tw-transition ${
                  categoryId === category.id ? "tw-border-mint-700 tw-bg-mint-700 tw-text-white tw-shadow-sm" : "tw-border-slate-200 tw-bg-white tw-text-slate-500 hover:tw-border-mint-300 hover:tw-text-mint-700 dark:tw-border-slate-700 dark:tw-bg-slate-800 dark:tw-text-slate-300"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
        {productsQuery.isLoading ? (
          <LoadingSkeleton rows={8} cards />
        ) : productsQuery.data?.length ? (
          <div className="tw-grid tw-grid-cols-2 tw-gap-3.5 sm:tw-grid-cols-3 lg:tw-grid-cols-4 2xl:tw-grid-cols-5">
            {productsQuery.data.map((product) => (
              <ProductCard key={product.id} product={product} onClick={(item) => { setEditingLine(null); setGiftVariantId(null); setSelectedProduct(item); }} />
            ))}
          </div>
        ) : (
          <EmptyState title="Không tìm thấy món kem" description="Thử từ khóa hoặc danh mục khác." />
        )}
      </section>

      <aside className="tw-flex tw-w-full tw-flex-col tw-border-t tw-border-slate-200 tw-bg-white tw-shadow-[-10px_0_30px_rgba(15,52,46,0.04)] xl:tw-h-full xl:tw-w-[420px] xl:tw-border-l xl:tw-border-t-0 dark:tw-border-slate-800 dark:tw-bg-slate-900">
        <div className="tw-flex tw-items-center tw-justify-between tw-border-b tw-border-slate-100 tw-px-5 tw-py-4 dark:tw-border-slate-800">
          <div className="tw-flex tw-items-center tw-gap-3">
            <div className="tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-xl tw-bg-[#0b2924] tw-text-white dark:tw-bg-mint-700"><ShoppingCart size={20} /></div>
            <div><strong className="tw-block tw-text-[15px] tw-font-extrabold">Đơn hiện tại</strong><span className="tw-text-[11px] tw-text-slate-400">{cart.reduce((sum, line) => sum + line.quantity, 0)} món đã chọn</span></div>
          </div>
          <Button variant="text" size="small" startIcon={<ArchiveRestore size={16} />} onClick={() => setDraftsOpen(true)}>Đơn tạm</Button>
        </div>
        <div className="soft-scrollbar tw-min-h-64 tw-flex-1 tw-overflow-y-auto tw-bg-[#fbfcfc] tw-p-4 dark:tw-bg-slate-950/25">
          {!cart.length ? (
            <EmptyState title="Giỏ hàng đang trống" description="Chạm vào món kem bên trái để bắt đầu." />
          ) : (
            <div className="tw-space-y-3">
              {cart.map((line) => (
                <div key={line.cartId} className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-p-3 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
                  <div className="tw-flex tw-gap-3">
                    <div className="tw-flex tw-h-12 tw-w-12 tw-shrink-0 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-lg tw-bg-mint-50 dark:tw-bg-slate-800">
                      {line.imageUrl ? <img src={line.imageUrl} alt="" className="tw-h-full tw-w-full tw-object-cover" /> : <IceCreamBowl size={22} className="tw-text-mint-500" />}
                    </div>
                    <div className="tw-min-w-0 tw-flex-1">
                      <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
                        <div><strong className="tw-block tw-truncate tw-text-sm">{line.productName}</strong><span className="tw-text-xs tw-text-slate-400">{line.variantName}</span></div>
                        <div className="tw-flex">
                          <IconButton size="small" onClick={() => openEdit(line)} aria-label="Sửa món"><Pencil size={15} /></IconButton>
                          <IconButton size="small" color="error" onClick={() => removeLine(line.cartId)} aria-label="Xóa món"><Trash2 size={15} /></IconButton>
                        </div>
                      </div>
                      <div className="tw-mt-2 tw-flex tw-items-center tw-justify-between">
                        <div className="tw-flex tw-items-center tw-gap-1 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-0.5 dark:tw-border-slate-700 dark:tw-bg-slate-800">
                          <IconButton size="small" onClick={() => updateQuantity(line.cartId, line.quantity - 1)}><Minus size={14} /></IconButton>
                          <span className="tw-w-6 tw-text-center tw-text-sm tw-font-black">{line.quantity}</span>
                          <IconButton size="small" onClick={() => updateQuantity(line.cartId, line.quantity + 1)}><Plus size={14} /></IconButton>
                        </div>
                        <strong className="tw-text-sm tw-text-mint-700">{formatMoney(line.displayUnitPrice * line.quantity)}</strong>
                      </div>
                    </div>
                  </div>
                  {line.note && <div className="tw-mt-2 tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-slate-400"><NotebookPen size={13} /> {line.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="tw-border-t tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-800 dark:tw-bg-slate-900">
          <Accordion disableGutters elevation={0} sx={{ bgcolor: "transparent" }}>
            <AccordionSummary expandIcon={<ChevronDown size={18} />} sx={{ px: 0, minHeight: 40 }}>
              <span className="tw-text-sm tw-font-black">Khách hàng & ưu đãi</span>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 1 }}>
              <div className="tw-space-y-3">
                <CustomerPicker
                  customer={customer}
                  branchId={user?.branch?.id}
                  onSelect={(value) => {
                    setCustomer(value);
                    setPromotionCode("");
                    setPromotionInput("");
                  }}
                />
                {branchVouchers.length > 0 && (
                  <div>
                    <div className="tw-mb-2 tw-flex tw-items-center tw-gap-1.5 tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wide tw-text-slate-500">
                      <Gift size={14} className="tw-text-mint-600" /> Voucher dùng tại {user?.branch?.name}
                    </div>
                    <div className="tw-space-y-2">
                      {branchVouchers.map((voucher) => {
                        const selected = promotionCode === voucher.code;
                        return (
                          <button
                            key={voucher.id}
                            type="button"
                            onClick={() => {
                              const nextCode = selected ? "" : voucher.code;
                              setPromotionInput(nextCode);
                              setPromotionCode(nextCode);
                            }}
                            className={`tw-flex tw-w-full tw-items-center tw-justify-between tw-gap-3 tw-rounded-xl tw-border tw-p-3 tw-text-left tw-transition ${
                              selected
                                ? "tw-border-mint-500 tw-bg-mint-50 dark:tw-bg-mint-500/10"
                                : "tw-border-slate-200 hover:tw-border-mint-300 dark:tw-border-slate-700"
                            }`}
                          >
                            <span>
                              <strong className="tw-block tw-text-sm">{voucher.code}</strong>
                              <span className="tw-text-[11px] tw-text-slate-500">
                                {voucher.type === "PERCENT"
                                  ? `Giảm ${voucher.value}%`
                                  : `Giảm ${formatMoney(voucher.value)}`}{" "}
                                · {voucher.branch.name} · Hạn {formatDate(voucher.expiresAt)}
                              </span>
                            </span>
                            <span className="tw-rounded-full tw-bg-mint-100 tw-px-2.5 tw-py-1 tw-text-[10px] tw-font-black tw-text-mint-700 dark:tw-bg-mint-900/30">
                              {selected ? "Đang dùng" : "Áp dụng"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {promotionsQuery.data?.some((promotion) => promotion.type === "BUY_X_GET_Y") && (
                  <div>
                    <div className="tw-mb-2 tw-flex tw-items-center tw-gap-1.5 tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wide tw-text-slate-500">
                      <Sparkles size={14} className="tw-text-amber-500" /> Ưu đãi nhanh
                    </div>
                    <div className="tw-space-y-2">
                      {promotionsQuery.data
                        .filter((promotion) => promotion.type === "BUY_X_GET_Y")
                        .map((promotion) => {
                          const selected = promotionCode === promotion.code;
                          return (
                            <button
                              key={promotion.id}
                              type="button"
                              onClick={() => selectPromotion(promotion)}
                              className={`tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-p-3 tw-text-left tw-transition ${
                                selected
                                  ? "tw-border-amber-400 tw-bg-amber-50 tw-shadow-sm dark:tw-border-amber-600 dark:tw-bg-amber-500/10"
                                  : "tw-border-slate-200 tw-bg-white hover:tw-border-amber-300 hover:tw-bg-amber-50/60 dark:tw-border-slate-700 dark:tw-bg-slate-900"
                              }`}
                            >
                              <span className="tw-flex tw-h-9 tw-w-9 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-bg-amber-100 tw-text-amber-700 dark:tw-bg-amber-500/15 dark:tw-text-amber-300">
                                <Gift size={18} />
                              </span>
                              <span className="tw-min-w-0 tw-flex-1">
                                <strong className="tw-block tw-text-sm">{promotion.name}</strong>
                                <span className="tw-block tw-truncate tw-text-[11px] tw-text-slate-500">
                                  Mua {promotion.buyQuantity} tặng {promotion.getQuantity} · Mã {promotion.code}
                                </span>
                              </span>
                              <span className={`tw-rounded-full tw-px-2.5 tw-py-1 tw-text-[10px] tw-font-black ${
                                selected
                                  ? "tw-bg-amber-500 tw-text-white"
                                  : "tw-bg-slate-100 tw-text-slate-500 dark:tw-bg-slate-800"
                              }`}>
                                {selected ? "Đang dùng" : "Áp dụng"}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
                <div className="tw-flex tw-gap-2">
                  <Input label="Mã ưu đãi / voucher" value={promotionInput} onChange={(event) => setPromotionInput(event.target.value.toUpperCase())} />
                  <Button variant="outlined" onClick={applyPromotion} disabled={!promotionInput.trim()}>Áp dụng</Button>
                </div>
                <Input label="Phí giao hàng" type="number" value={deliveryFee} onChange={(event) => setDeliveryFee(Math.max(0, Number(event.target.value)))} />
                <Input label="Ghi chú toàn đơn" multiline rows={2} value={orderNote} onChange={(event) => setOrderNote(event.target.value)} />
              </div>
            </AccordionDetails>
          </Accordion>

          {quoteQuery.isError && (
            <div className="tw-mb-3 tw-rounded-xl tw-bg-rose-50 tw-p-2 tw-text-xs tw-font-bold tw-text-rose-600 dark:tw-bg-rose-900/20">
              {apiMessage(quoteQuery.error)}
            </div>
          )}
          {quote?.promotion && (
            <div className="tw-mb-3 tw-flex tw-items-start tw-gap-2.5 tw-rounded-xl tw-border tw-border-emerald-200 tw-bg-emerald-50 tw-p-3 dark:tw-border-emerald-800 dark:tw-bg-emerald-900/20">
              <Gift size={18} className="tw-mt-0.5 tw-shrink-0 tw-text-emerald-600" />
              <div className="tw-min-w-0 tw-flex-1">
                <strong className="tw-block tw-text-xs tw-text-emerald-800 dark:tw-text-emerald-200">
                  Đã áp dụng {quote.promotion.name}
                </strong>
                <span className="tw-mt-0.5 tw-block tw-text-[11px] tw-text-emerald-700/80 dark:tw-text-emerald-300/80">
                  {quote.promotion.type === "BUY_X_GET_Y"
                    ? `Tặng ${quote.promotion.benefit?.freeQuantity || quote.promotion.getQuantity} món giá thấp nhất`
                    : `Mã ${quote.promotion.code}`}{" "}
                  · Giảm {formatMoney(quote.discountAmount)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPromotionCode("");
                  setPromotionInput("");
                }}
                className="tw-border-0 tw-bg-transparent tw-p-0 tw-text-[11px] tw-font-bold tw-text-emerald-700 tw-underline"
              >
                Bỏ
              </button>
            </div>
          )}
          {quote?.voucher && (
            <div className="tw-mb-3 tw-flex tw-items-start tw-gap-2.5 tw-rounded-xl tw-border tw-border-mint-200 tw-bg-mint-50 tw-p-3 dark:tw-border-mint-800 dark:tw-bg-mint-900/20">
              <Gift size={18} className="tw-mt-0.5 tw-shrink-0 tw-text-mint-600" />
              <div className="tw-min-w-0 tw-flex-1">
                <strong className="tw-block tw-text-xs tw-text-mint-800 dark:tw-text-mint-200">
                  Voucher {quote.voucher.code}
                </strong>
                <span className="tw-mt-0.5 tw-block tw-text-[11px] tw-text-mint-700/80 dark:tw-text-mint-300/80">
                  {quote.voucher.branch.name} · Giảm {formatMoney(quote.voucherDiscount)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPromotionCode("");
                  setPromotionInput("");
                }}
                className="tw-border-0 tw-bg-transparent tw-p-0 tw-text-[11px] tw-font-bold tw-text-mint-700 tw-underline"
              >
                Bỏ
              </button>
            </div>
          )}
          {quote?.activeMembership && quote?.membershipBenefit && (
            <div className="tw-mb-3 tw-flex tw-items-start tw-gap-2.5 tw-rounded-xl tw-border tw-border-lavender-200 tw-bg-lavender-50 tw-p-3 dark:tw-border-lavender-800 dark:tw-bg-lavender-900/20">
              <Crown size={18} className="tw-mt-0.5 tw-shrink-0 tw-text-lavender-500" />
              <div className="tw-min-w-0 tw-flex-1">
                <strong className="tw-block tw-text-xs tw-text-lavender-700 dark:tw-text-lavender-200">
                  {quote.activeMembership.plan.name}
                </strong>
                <span className="tw-mt-0.5 tw-block tw-text-[11px] tw-text-slate-600 dark:tw-text-slate-300">
                  {quote.membershipBenefit.usedToday
                    ? "Khách đã sử dụng quyền lợi miễn phí hôm nay"
                    : quote.membershipBenefit.available
                      ? `Miễn phí ${quote.membershipBenefit.freeQuantity} ${quote.activeMembership.plan.benefitVariant?.product?.name || "món quà"} · Giảm ${formatMoney(quote.membershipDiscount)}`
                      : `Tặng ${quote.activeMembership.plan.benefitVariant?.product?.name || "sản phẩm đã cấu hình"} — ${quote.activeMembership.plan.benefitVariant?.name || ""}`}
                </span>
                {!quote.membershipBenefit.usedToday && !quote.membershipBenefit.available && quote.activeMembership.plan.benefitVariant && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<Gift size={14} />}
                    onClick={addMembershipGift}
                    className="!tw-mt-1 !tw-p-0 !tw-text-[11px]"
                  >
                    Thêm quà vào đơn
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="tw-space-y-2 tw-rounded-xl tw-bg-slate-50 tw-p-3 tw-text-xs dark:tw-bg-slate-800/70">
            <div className="tw-flex tw-justify-between"><span className="tw-text-slate-500">Tiền hàng</span><span>{formatMoney(quote?.originalAmount ?? localTotal)}</span></div>
            <div className="tw-flex tw-justify-between"><span className="tw-text-slate-500">Giảm giá</span><span>-{formatMoney((quote?.discountAmount || 0) + (quote?.voucherDiscount || 0) + (quote?.membershipDiscount || 0))}</span></div>
            <div className="tw-flex tw-justify-between"><span className="tw-text-slate-500">VAT {quote?.vatRate || 8}%</span><span>{formatMoney(quote?.taxAmount || 0)}</span></div>
            <div className="tw-flex tw-justify-between"><span className="tw-text-slate-500">Phí giao hàng</span><span>{formatMoney(quote?.deliveryFee || deliveryFee)}</span></div>
            <div className="tw-flex tw-items-end tw-justify-between tw-border-t tw-border-dashed tw-border-slate-300 tw-pt-3 dark:tw-border-slate-700">
              <strong className="tw-text-[13px]">Tổng thanh toán</strong><strong className="tw-text-[25px] tw-font-extrabold tw-tracking-[-0.04em] tw-text-mint-700 dark:tw-text-mint-300">{formatMoney(total)}</strong>
            </div>
          </div>

          <div className="tw-my-3 tw-grid tw-grid-cols-4 tw-gap-2">
            {Object.entries(paymentMethodLabels).filter(([method]) => method !== "MIXED").map(([method, label]) => {
              const Icon = paymentIcons[method];
              return (
                <button
                  type="button"
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`tw-flex tw-flex-col tw-items-center tw-gap-1 tw-rounded-xl tw-border tw-p-2.5 tw-text-[10px] tw-font-bold tw-transition ${
                    paymentMethod === method ? "tw-border-mint-600 tw-bg-mint-50 tw-text-mint-700 tw-shadow-sm dark:tw-bg-mint-700/20" : "tw-border-slate-200 tw-bg-transparent tw-text-slate-500 hover:tw-border-slate-300 dark:tw-border-slate-700"
                  }`}
                >
                  <Icon size={18} /><span className="tw-line-clamp-1">{label}</span>
                </button>
              );
            })}
          </div>
          {paymentMethod === "CASH" && cart.length > 0 && (
            <div className="tw-mb-3 tw-grid tw-grid-cols-2 tw-gap-2">
              <Input label="Tiền khách đưa" type="number" value={customerPaid} onChange={(event) => setCustomerPaid(Math.max(0, Number(event.target.value)))} />
              <div className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-2 dark:tw-border-slate-700 dark:tw-bg-slate-800">
                <div className="tw-text-[11px] tw-text-slate-400">Tiền thừa</div>
                <strong className="tw-text-sm">{formatMoney(change)}</strong>
              </div>
            </div>
          )}
          <div className="tw-grid tw-grid-cols-[1fr_1fr_2fr] tw-gap-2">
            <Button variant="outlined" color="error" disabled={!cart.length} onClick={() => setClearConfirm(true)} aria-label="Hủy giỏ"><XCircle size={18} /></Button>
            <Button variant="outlined" disabled={!cart.length || !shiftQuery.data} onClick={() => saveOrderMutation.mutate(true)} aria-label="Lưu tạm"><Save size={18} /></Button>
            <Button size="large" disabled={!cart.length || !shiftQuery.data || quoteQuery.isFetching || quoteQuery.isError} loading={saveOrderMutation.isPending && saveOrderMutation.variables === false} onClick={checkout}>
              Thanh toán
            </Button>
          </div>
        </div>
      </aside>

      <ProductCustomizer
        open={Boolean(selectedProduct)}
        product={selectedProduct}
        flavors={flavorsQuery.data || []}
        toppings={toppingsQuery.data || []}
        initial={customizeInitial}
        presetVariantId={giftVariantId}
        lockVariant={Boolean(giftVariantId)}
        onClose={() => { setSelectedProduct(null); setEditingLine(null); setGiftVariantId(null); }}
        onSave={addOrUpdateLine}
      />
      <ConfirmDialog
        open={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={() => { clearCart(); setClearConfirm(false); toast.info("Đã hủy giỏ hàng"); }}
        title="Hủy đơn hiện tại?"
        message="Toàn bộ món, ưu đãi và thông tin khách hàng trong giỏ sẽ bị xóa."
        confirmText="Hủy đơn"
      />
      <Modal open={draftsOpen} onClose={() => setDraftsOpen(false)} title="Đơn tạm của tôi" maxWidth="md">
        {draftsQuery.isLoading ? <LoadingSkeleton rows={4} /> : draftsQuery.data?.length ? (
          <div className="tw-space-y-3">
            {draftsQuery.data.map((draft) => (
              <button key={draft.id} type="button" onClick={() => restoreDraft(draft)} className="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-100 tw-bg-transparent tw-p-4 tw-text-left hover:tw-bg-mint-50 dark:tw-border-slate-700 dark:hover:tw-bg-mint-700/10">
                <Receipt size={20} className="tw-text-mint-600" />
                <div className="tw-flex-1"><strong className="tw-block">{draft.code}</strong><span className="tw-text-xs tw-text-slate-400">{formatDate(draft.updatedAt, true)} · {draft.items.length} dòng món</span></div>
                <strong>{formatMoney(draft.totalAmount)}</strong>
              </button>
            ))}
          </div>
        ) : <EmptyState title="Chưa có đơn tạm" />}
      </Modal>
      <Modal
        open={Boolean(completedOrder)}
        onClose={() => setCompletedOrder(null)}
        title="Thanh toán thành công"
        actions={
          <>
            <Button
              variant="outlined"
              disabled={!completedOrder}
              onClick={() => completedOrder && downloadFile(`/orders/${completedOrder.id}/invoice.pdf`, `${completedOrder.code}.pdf`)}
            >
              Tải hóa đơn PDF
            </Button>
            <Button onClick={() => setCompletedOrder(null)}>Tạo đơn mới</Button>
          </>
        }
      >
        <div className="tw-flex tw-flex-col tw-items-center tw-py-5 tw-text-center">
          <CheckCircle2 size={58} className="tw-text-emerald-500" />
          <h3 className="tw-mb-1 tw-mt-4 tw-text-2xl tw-font-black">{completedOrder?.code}</h3>
          <p className="tw-m-0 tw-text-slate-500">Đơn hàng đã lưu, kho và điểm xếp hạng đã được cập nhật.</p>
          <strong className="tw-mt-5 tw-text-3xl tw-text-mint-700">{formatMoney(completedOrder?.totalAmount)}</strong>
          {completedOrder?.issuedVouchers?.map((voucher) => (
            <div key={voucher.id} className="tw-mt-5 tw-w-full tw-rounded-2xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-p-4 tw-text-left dark:tw-border-amber-800 dark:tw-bg-amber-900/20">
              <div className="tw-flex tw-items-center tw-gap-2 tw-font-black tw-text-amber-800 dark:tw-text-amber-200">
                <Gift size={18} /> Khách vừa nhận voucher hạng {voucher.membershipLevel.name}
              </div>
              <div className="tw-mt-2 tw-flex tw-items-end tw-justify-between tw-gap-3">
                <strong className="tw-text-lg tw-tracking-wide">{voucher.code}</strong>
                <span className="tw-text-xs tw-text-slate-500">{voucher.branch.name} · Hạn {formatDate(voucher.expiresAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
