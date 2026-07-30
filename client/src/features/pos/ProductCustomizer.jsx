import { useEffect, useMemo, useState } from "react";
import { Check, IceCreamBowl, Minus, Plus, X } from "lucide-react";
import { Checkbox, FormControlLabel, IconButton } from "@mui/material";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import { formatMoney } from "../../utils/format";

export default function ProductCustomizer({
  open,
  product,
  flavors,
  toppings,
  initial,
  presetVariantId,
  lockVariant = false,
  onClose,
  onSave,
}) {
  const [variantId, setVariantId] = useState("");
  const [flavorIds, setFlavorIds] = useState([]);
  const [toppingIds, setToppingIds] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!product) return;
    setVariantId(
      initial?.variantId ||
      presetVariantId ||
      product.variants.find((item) => item.isActive)?.id ||
      "",
    );
    setFlavorIds(initial?.flavorIds || []);
    setToppingIds(initial?.toppingIds || []);
    setQuantity(initial?.quantity || 1);
    setNote(initial?.note || "");
  }, [product, initial, presetVariantId, open]);

  const variant = product?.variants.find((item) => item.id === variantId);
  const totalUnit = useMemo(() => {
    if (!variant) return 0;
    return (
      variant.price +
      flavorIds.reduce(
        (sum, id) => sum + (flavors.find((item) => item.id === id)?.extraPrice || 0),
        0,
      ) +
      toppingIds.reduce(
        (sum, id) => sum + (toppings.find((item) => item.id === id)?.price || 0),
        0,
      )
    );
  }, [variant, flavorIds, toppingIds, flavors, toppings]);

  if (!product) return null;
  const scoopCount = variant?.scoopCount || 0;
  const selectFlavor = (id) => {
    if (flavorIds.length < scoopCount) setFlavorIds((current) => [...current, id]);
  };
  const selectVariant = (id) => {
    setVariantId(id);
    setFlavorIds([]);
  };
  const toggleTopping = (id) => {
    setToppingIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };
  const save = () => {
    onSave({
      cartId: initial?.cartId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      categoryId: product.categoryId,
      variantId,
      variantName: variant.name,
      flavorIds,
      toppingIds,
      quantity,
      note,
      displayUnitPrice: totalUnit,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Chỉnh sửa món" : presetVariantId ? "Thêm quà hội viên" : "Tùy chọn món kem"}
      maxWidth="md"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose}>Hủy</Button>
          <Button
            onClick={save}
            disabled={!variant || flavorIds.length !== scoopCount}
            startIcon={<Check size={17} />}
          >
            {initial ? "Lưu thay đổi" : "Thêm vào giỏ"} · {formatMoney(totalUnit * quantity)}
          </Button>
        </>
      }
    >
      <div className="tw-grid tw-gap-6 md:tw-grid-cols-[220px_1fr]">
        <div>
          <div className="tw-flex tw-h-48 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-[#edf5f2] dark:tw-border-slate-700 dark:tw-bg-slate-800">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="tw-h-full tw-w-full tw-object-cover" />
            ) : (
              <IceCreamBowl size={64} className="tw-text-mint-500" />
            )}
          </div>
          <h3 className="tw-mb-1 tw-mt-4 tw-text-xl tw-font-extrabold tw-tracking-[-0.025em]">{product.name}</h3>
          <p className="tw-m-0 tw-text-sm tw-leading-6 tw-text-slate-500">{product.description}</p>
        </div>
        <div className="tw-space-y-6">
          <div>
            <div className="tw-mb-2 tw-text-xs tw-font-extrabold tw-uppercase tw-tracking-wide tw-text-slate-600 dark:tw-text-slate-300">1. Chọn kích thước / biến thể</div>
            <Select
              label="Biến thể"
              value={variantId}
              disabled={lockVariant}
              onChange={(event) => selectVariant(event.target.value)}
              options={product.variants
                .filter((item) => item.isActive)
                .map((item) => ({
                  value: item.id,
                  label: `${item.name} · ${item.scoopCount} viên · ${formatMoney(item.price)}`,
                }))}
            />
          </div>
          <div>
            <div className="tw-flex tw-items-center tw-justify-between">
              <div className="tw-text-xs tw-font-extrabold tw-uppercase tw-tracking-wide tw-text-slate-600 dark:tw-text-slate-300">2. Chọn hương vị cho từng viên</div>
              <span className="tw-text-xs tw-font-bold tw-text-mint-700">{flavorIds.length}/{scoopCount} viên</span>
            </div>
            <div className="tw-my-3 tw-flex tw-flex-wrap tw-gap-2">
              {Array.from({ length: scoopCount }, (_, index) => {
                const flavor = flavors.find((item) => item.id === flavorIds[index]);
                return (
                  <div key={index} className="tw-flex tw-h-10 tw-items-center tw-gap-2 tw-rounded-xl tw-border tw-border-dashed tw-border-slate-300 tw-px-3 tw-text-xs tw-font-bold dark:tw-border-slate-600">
                    <span>Viên {index + 1}:</span>
                    {flavor ? (
                      <>
                        <span className="tw-h-3 tw-w-3 tw-rounded-full" style={{ background: flavor.color }} />
                        <span>{flavor.name}</span>
                        <button type="button" className="tw-border-0 tw-bg-transparent tw-p-0 tw-text-rose-500" onClick={() => setFlavorIds((current) => current.filter((_, position) => position !== index))}>
                          <X size={14} />
                        </button>
                      </>
                    ) : <span className="tw-text-slate-400">Chưa chọn</span>}
                  </div>
                );
              })}
            </div>
            <div className="tw-grid tw-grid-cols-2 tw-gap-2 sm:tw-grid-cols-3">
              {flavors.map((flavor) => (
                <button
                  type="button"
                  key={flavor.id}
                  disabled={flavorIds.length >= scoopCount}
                  onClick={() => selectFlavor(flavor.id)}
                  className="tw-flex tw-items-center tw-gap-2 tw-rounded-xl tw-border tw-border-slate-200 tw-bg-transparent tw-p-2.5 tw-text-left tw-text-sm tw-font-bold tw-transition hover:tw-border-mint-400 hover:tw-bg-mint-50/50 disabled:tw-opacity-50 dark:tw-border-slate-700 dark:hover:tw-bg-mint-700/10"
                >
                  <span className="tw-h-6 tw-w-6 tw-shrink-0 tw-rounded-full tw-shadow-inner" style={{ background: flavor.color }} />
                  <span className="tw-min-w-0 tw-flex-1 tw-truncate">{flavor.name}</span>
                  {flavor.extraPrice > 0 && <span className="tw-text-[10px] tw-text-slate-400">+{Math.round(flavor.extraPrice / 1000)}k</span>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="tw-mb-2 tw-text-xs tw-font-extrabold tw-uppercase tw-tracking-wide tw-text-slate-600 dark:tw-text-slate-300">3. Thêm topping tùy thích</div>
            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2">
              {toppings.map((topping) => (
                <FormControlLabel
                  key={topping.id}
                  control={<Checkbox checked={toppingIds.includes(topping.id)} onChange={() => toggleTopping(topping.id)} />}
                  label={<span className="tw-text-sm">{topping.name} <span className="tw-text-slate-400">+{formatMoney(topping.price)}</span></span>}
                />
              ))}
            </div>
          </div>
          <div className="tw-grid tw-gap-4 sm:tw-grid-cols-[160px_1fr]">
            <div>
              <div className="tw-mb-2 tw-text-sm tw-font-black">Số lượng</div>
              <div className="tw-flex tw-items-center tw-justify-between tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-1 dark:tw-border-slate-700 dark:tw-bg-slate-800">
                <IconButton size="small" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={17} /></IconButton>
                <strong>{quantity}</strong>
                <IconButton size="small" onClick={() => setQuantity((value) => Math.min(99, value + 1))}><Plus size={17} /></IconButton>
              </div>
            </div>
            <label className="tw-text-sm tw-font-black">
              Ghi chú riêng
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ít ngọt, không sốt..."
                className="tw-mt-2 tw-h-10 tw-w-full tw-rounded-xl tw-border tw-border-slate-200 tw-bg-transparent tw-px-3 tw-font-normal dark:tw-border-slate-700"
              />
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
