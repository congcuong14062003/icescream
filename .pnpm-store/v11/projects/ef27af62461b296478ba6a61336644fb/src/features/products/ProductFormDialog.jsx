import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IconButton, Switch } from "@mui/material";
import { Plus, Trash2 } from "lucide-react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import UploadImage from "../../components/common/UploadImage";

const emptyVariant = {
  sku: "",
  name: "S",
  size: "S",
  cupType: "Ly giấy",
  scoopCount: 1,
  price: 29000,
  costPrice: 12000,
  isActive: true,
};

function productDefaults(product) {
  return {
    code: product?.code || "",
    name: product?.name || "",
    categoryId: product?.categoryId || "",
    description: product?.description || "",
    imageUrl: product?.imageUrl || "",
    price: product?.price || 29000,
    costPrice: product?.costPrice || 12000,
    status: product?.status || "ACTIVE",
    isFeatured: product?.isFeatured || false,
    displayOrder: product?.displayOrder || 0,
  };
}

export default function ProductFormDialog({ open, product, categories, onClose, onSubmit, loading }) {
  const [variants, setVariants] = useState([{ ...emptyVariant }]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({ defaultValues: productDefaults(product) });
  const imageUrl = watch("imageUrl");

  useEffect(() => {
    reset(productDefaults(product));
    setVariants(
      product?.variants?.length
        ? product.variants.map((variant) => ({ ...variant }))
        : [{ ...emptyVariant }],
    );
  }, [product, open, reset]);

  const updateVariant = (index, key, value) => {
    setVariants((current) =>
      current.map((variant, position) =>
        position === index ? { ...variant, [key]: value } : variant,
      ),
    );
  };
  const submit = (values) => {
    onSubmit({
      ...values,
      imageUrl: values.imageUrl || null,
      price: Number(values.price),
      costPrice: Number(values.costPrice),
      displayOrder: Number(values.displayOrder),
      variants: variants.map((variant) => ({
        ...variant,
        scoopCount: Number(variant.scoopCount),
        price: Number(variant.price),
        costPrice: Number(variant.costPrice),
      })),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới"}
      maxWidth="md"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose}>Hủy</Button>
          <Button loading={loading} onClick={handleSubmit(submit)}>{product ? "Lưu thay đổi" : "Tạo sản phẩm"}</Button>
        </>
      }
    >
      <div className="tw-space-y-6 tw-py-2">
        <UploadImage value={imageUrl} onChange={(value) => setValue("imageUrl", value, { shouldDirty: true })} />
        <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
          <Input label="Mã sản phẩm" error={errors.code} {...register("code", { required: "Vui lòng nhập mã" })} />
          <Input label="Tên sản phẩm" error={errors.name} {...register("name", { required: "Vui lòng nhập tên" })} />
          <Controller
            control={control}
            name="categoryId"
            rules={{ required: "Vui lòng chọn danh mục" }}
            render={({ field }) => (
              <Select
                label="Danh mục"
                options={categories.map((item) => ({ value: item.id, label: item.name }))}
                error={errors.categoryId}
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                label="Trạng thái"
                options={[
                  { value: "ACTIVE", label: "Đang bán" },
                  { value: "INACTIVE", label: "Ngừng bán" },
                  { value: "OUT_OF_STOCK", label: "Hết hàng" },
                ]}
                {...field}
              />
            )}
          />
          <Input label="Giá bán cơ bản" type="number" error={errors.price} {...register("price", { required: "Vui lòng nhập giá", min: { value: 0, message: "Giá không hợp lệ" } })} />
          <Input label="Giá vốn cơ bản" type="number" error={errors.costPrice} {...register("costPrice", { required: "Vui lòng nhập giá vốn", min: 0 })} />
          <Input label="Thứ tự hiển thị" type="number" {...register("displayOrder", { min: 0 })} />
          <Controller
            control={control}
            name="isFeatured"
            render={({ field }) => (
              <label className="tw-flex tw-h-10 tw-items-center tw-justify-between tw-rounded-xl tw-border tw-border-slate-200 tw-px-3 tw-text-sm tw-font-bold dark:tw-border-slate-700">
                Sản phẩm nổi bật
                <Switch checked={field.value} onChange={(_, value) => field.onChange(value)} />
              </label>
            )}
          />
        </div>
        <Input label="Mô tả" multiline rows={3} {...register("description")} />
        <div>
          <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
            <div>
              <h3 className="tw-m-0 tw-text-base tw-font-black">Biến thể và SKU</h3>
              <p className="tw-mb-0 tw-mt-1 tw-text-xs tw-text-slate-400">Mỗi biến thể có giá và định lượng viên kem riêng.</p>
            </div>
            <Button variant="outlined" size="small" startIcon={<Plus size={16} />} onClick={() => setVariants((current) => [...current, { ...emptyVariant, sku: "" }])}>Thêm biến thể</Button>
          </div>
          <div className="tw-space-y-3">
            {variants.map((variant, index) => (
              <div key={variant.id || index} className="tw-grid tw-gap-3 tw-rounded-2xl tw-bg-slate-50 tw-p-3 sm:tw-grid-cols-2 lg:tw-grid-cols-4 dark:tw-bg-slate-800">
                <Input label="SKU" value={variant.sku} onChange={(event) => updateVariant(index, "sku", event.target.value.toUpperCase())} required />
                <Input label="Tên biến thể" value={variant.name} onChange={(event) => updateVariant(index, "name", event.target.value)} required />
                <Input label="Kích thước" value={variant.size || ""} onChange={(event) => updateVariant(index, "size", event.target.value)} />
                <Input label="Loại ly / ốc quế" value={variant.cupType || ""} onChange={(event) => updateVariant(index, "cupType", event.target.value)} />
                <Input label="Số viên" type="number" inputProps={{ min: 0, max: 12 }} value={variant.scoopCount} onChange={(event) => updateVariant(index, "scoopCount", event.target.value)} />
                <Input label="Giá bán" type="number" inputProps={{ min: 0 }} value={variant.price} onChange={(event) => updateVariant(index, "price", event.target.value)} />
                <Input label="Giá vốn" type="number" inputProps={{ min: 0 }} value={variant.costPrice} onChange={(event) => updateVariant(index, "costPrice", event.target.value)} />
                <div className="tw-flex tw-items-center tw-justify-between">
                  <label className="tw-flex tw-items-center tw-text-xs tw-font-bold">
                    <Switch size="small" checked={variant.isActive} onChange={(_, value) => updateVariant(index, "isActive", value)} />
                    Đang dùng
                  </label>
                  <IconButton color="error" disabled={variants.length === 1} onClick={() => setVariants((current) => current.filter((_, position) => position !== index))} aria-label="Xóa biến thể">
                    <Trash2 size={17} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

