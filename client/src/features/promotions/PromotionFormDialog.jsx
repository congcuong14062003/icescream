import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Autocomplete,
  FormControlLabel,
  Switch,
  TextField,
} from "@mui/material";
import dayjs from "dayjs";
import { Gift, Percent, Save, TimerReset } from "lucide-react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";

export const promotionTypes = [
  { value: "PERCENT", label: "Giảm theo phần trăm" },
  { value: "FIXED_AMOUNT", label: "Giảm số tiền cố định" },
  { value: "BUY_X_GET_Y", label: "Mua X tặng Y" },
  { value: "PRODUCT", label: "Giảm theo sản phẩm" },
  { value: "CATEGORY", label: "Giảm theo danh mục" },
  { value: "MEMBER", label: "Ưu đãi thành viên" },
  { value: "HAPPY_HOUR", label: "Khung giờ vàng" },
];

function localDateTime(value) {
  return value
    ? dayjs(value).format("YYYY-MM-DDTHH:mm")
    : "";
}

function emptyForm() {
  return {
    code: "",
    name: "",
    description: "",
    type: "BUY_X_GET_Y",
    value: 0,
    startAt: dayjs().startOf("hour").format("YYYY-MM-DDTHH:mm"),
    endAt: dayjs().add(30, "day").endOf("day").format("YYYY-MM-DDTHH:mm"),
    minOrderValue: 0,
    maxDiscount: "",
    totalUsageLimit: "",
    usagePerCustomer: 1,
    buyQuantity: 3,
    getQuantity: 1,
    startHour: 14,
    endHour: 17,
    memberOnly: false,
    isActive: true,
    scopeType: "ALL",
    productIds: [],
    categoryIds: [],
  };
}

function promotionForm(promotion) {
  if (!promotion) return emptyForm();
  return {
    code: promotion.code,
    name: promotion.name,
    description: promotion.description || "",
    type: promotion.type,
    value: promotion.value,
    startAt: localDateTime(promotion.startAt),
    endAt: localDateTime(promotion.endAt),
    minOrderValue: promotion.minOrderValue,
    maxDiscount: promotion.maxDiscount ?? "",
    totalUsageLimit: promotion.totalUsageLimit ?? "",
    usagePerCustomer: promotion.usagePerCustomer,
    buyQuantity: promotion.buyQuantity ?? 3,
    getQuantity: promotion.getQuantity ?? 1,
    startHour: promotion.startHour ?? 14,
    endHour: promotion.endHour ?? 17,
    memberOnly: promotion.memberOnly,
    isActive: promotion.isActive,
    scopeType: promotion.products.length
      ? "PRODUCT"
      : promotion.categories.length
        ? "CATEGORY"
        : "ALL",
    productIds: promotion.products.map((item) => item.productId),
    categoryIds: promotion.categories.map((item) => item.categoryId),
  };
}

function nullableNumber(value) {
  return value === "" || value === null || value === undefined
    ? null
    : Number(value);
}

export default function PromotionFormDialog({
  open,
  promotion,
  products,
  categories,
  loading,
  onClose,
  onSubmit,
}) {
  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ defaultValues: emptyForm() });
  const type = watch("type");
  const scopeType = watch("scopeType");

  useEffect(() => {
    if (open) reset(promotionForm(promotion));
  }, [open, promotion, reset]);

  const submit = handleSubmit((values) => {
    const productScope =
      values.type === "PRODUCT" ||
      (values.type === "BUY_X_GET_Y" && values.scopeType === "PRODUCT");
    const categoryScope =
      values.type === "CATEGORY" ||
      (values.type === "BUY_X_GET_Y" && values.scopeType === "CATEGORY");
    onSubmit({
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      description: values.description.trim() || null,
      type: values.type,
      value: values.type === "BUY_X_GET_Y" ? 0 : Number(values.value),
      startAt: new Date(values.startAt).toISOString(),
      endAt: new Date(values.endAt).toISOString(),
      minOrderValue: Number(values.minOrderValue || 0),
      maxDiscount: nullableNumber(values.maxDiscount),
      totalUsageLimit: nullableNumber(values.totalUsageLimit),
      usagePerCustomer: Number(values.usagePerCustomer || 1),
      buyQuantity: values.type === "BUY_X_GET_Y"
        ? Number(values.buyQuantity)
        : null,
      getQuantity: values.type === "BUY_X_GET_Y"
        ? Number(values.getQuantity)
        : null,
      startHour: values.type === "HAPPY_HOUR"
        ? Number(values.startHour)
        : null,
      endHour: values.type === "HAPPY_HOUR"
        ? Number(values.endHour)
        : null,
      memberOnly: values.type === "MEMBER" || Boolean(values.memberOnly),
      isActive: Boolean(values.isActive),
      productIds: productScope ? values.productIds : [],
      categoryIds: categoryScope ? values.categoryIds : [],
    });
  });

  const isPercentType = ["PERCENT", "PRODUCT", "CATEGORY", "MEMBER"].includes(type);
  const showProductScope =
    type === "PRODUCT" ||
    (type === "BUY_X_GET_Y" && scopeType === "PRODUCT");
  const showCategoryScope =
    type === "CATEGORY" ||
    (type === "BUY_X_GET_Y" && scopeType === "CATEGORY");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={promotion ? "Chỉnh sửa chương trình ưu đãi" : "Tạo chương trình ưu đãi"}
      maxWidth="md"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose}>Hủy</Button>
          <Button
            type="submit"
            form="promotion-form"
            loading={loading}
            startIcon={<Save size={17} />}
          >
            {promotion ? "Lưu thay đổi" : "Tạo ưu đãi"}
          </Button>
        </>
      }
    >
      <form id="promotion-form" onSubmit={submit} className="tw-space-y-6 tw-pt-2">
        <section className="tw-space-y-4">
          <div className="tw-flex tw-items-center tw-gap-2">
            <span className="tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-bg-mint-50 tw-text-mint-700 dark:tw-bg-mint-500/10">
              <Gift size={17} />
            </span>
            <div>
              <h3 className="tw-m-0 tw-text-sm tw-font-black">Thông tin chương trình</h3>
              <p className="tw-mb-0 tw-mt-0.5 tw-text-xs tw-text-slate-400">Tên và mã này sẽ hiển thị trực tiếp tại POS.</p>
            </div>
          </div>
          <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
            <Input
              label="Mã ưu đãi"
              error={errors.code}
              {...register("code", {
                required: "Vui lòng nhập mã ưu đãi",
                minLength: { value: 3, message: "Mã cần ít nhất 3 ký tự" },
                onChange: (event) => setValue("code", event.target.value.toUpperCase()),
              })}
            />
            <Input
              label="Tên chương trình"
              error={errors.name}
              {...register("name", {
                required: "Vui lòng nhập tên chương trình",
                minLength: { value: 3, message: "Tên cần ít nhất 3 ký tự" },
              })}
            />
            <div className="sm:tw-col-span-2">
              <Input
                label="Mô tả"
                multiline
                rows={2}
                error={errors.description}
                {...register("description", {
                  maxLength: { value: 1000, message: "Mô tả tối đa 1.000 ký tự" },
                })}
              />
            </div>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select label="Loại ưu đãi" options={promotionTypes} {...field} />
              )}
            />
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <div className="tw-flex tw-h-10 tw-items-center tw-rounded-xl tw-border tw-border-slate-200 tw-px-3 dark:tw-border-slate-700">
                  <FormControlLabel
                    control={<Switch checked={field.value} onChange={(_, value) => field.onChange(value)} />}
                    label={field.value ? "Đang bật tại POS" : "Đang tắt"}
                  />
                </div>
              )}
            />
          </div>
        </section>

        <section className="tw-space-y-4 tw-border-t tw-border-slate-100 tw-pt-5 dark:tw-border-slate-800">
          <div className="tw-flex tw-items-center tw-gap-2">
            <span className="tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-bg-amber-50 tw-text-amber-700 dark:tw-bg-amber-500/10">
              <Percent size={17} />
            </span>
            <div>
              <h3 className="tw-m-0 tw-text-sm tw-font-black">Điều kiện và giá trị ưu đãi</h3>
              <p className="tw-mb-0 tw-mt-0.5 tw-text-xs tw-text-slate-400">Backend sẽ kiểm tra lại toàn bộ điều kiện khi tính tiền.</p>
            </div>
          </div>

          {type === "BUY_X_GET_Y" ? (
            <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
              <Input
                label="Số lượng khách mua"
                type="number"
                inputProps={{ min: 1, max: 99 }}
                error={errors.buyQuantity}
                {...register("buyQuantity", {
                  required: "Vui lòng nhập số lượng mua",
                  min: { value: 1, message: "Tối thiểu là 1" },
                })}
              />
              <Input
                label="Số lượng được tặng"
                type="number"
                inputProps={{ min: 1, max: 99 }}
                error={errors.getQuantity}
                {...register("getQuantity", {
                  required: "Vui lòng nhập số lượng tặng",
                  min: { value: 1, message: "Tối thiểu là 1" },
                })}
              />
              <Controller
                name="scopeType"
                control={control}
                render={({ field }) => (
                  <div className="sm:tw-col-span-2">
                    <Select
                      label="Phạm vi món được áp dụng"
                      options={[
                        { value: "ALL", label: "Tất cả sản phẩm" },
                        { value: "PRODUCT", label: "Một số sản phẩm" },
                        { value: "CATEGORY", label: "Một số danh mục" },
                      ]}
                      {...field}
                    />
                  </div>
                )}
              />
            </div>
          ) : (
            <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
              <Input
                label={isPercentType ? "Phần trăm giảm (%)" : "Số tiền giảm (VNĐ)"}
                type="number"
                inputProps={{ min: 1 }}
                error={errors.value}
                {...register("value", {
                  required: "Vui lòng nhập giá trị ưu đãi",
                  min: { value: 1, message: "Giá trị phải lớn hơn 0" },
                  ...(isPercentType
                    ? { max: { value: 100, message: "Phần trăm tối đa là 100" } }
                    : {}),
                })}
              />
              {type === "HAPPY_HOUR" ? (
                <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                  <Input
                    label="Từ giờ"
                    type="number"
                    inputProps={{ min: 0, max: 23 }}
                    error={errors.startHour}
                    {...register("startHour", {
                      required: "Thiếu giờ bắt đầu",
                      min: 0,
                      max: 23,
                    })}
                  />
                  <Input
                    label="Đến giờ"
                    type="number"
                    inputProps={{ min: 1, max: 24 }}
                    error={errors.endHour}
                    {...register("endHour", {
                      required: "Thiếu giờ kết thúc",
                      min: 1,
                      max: 24,
                      validate: (value) =>
                        Number(value) > Number(watch("startHour")) ||
                        "Giờ kết thúc phải lớn hơn giờ bắt đầu",
                    })}
                  />
                </div>
              ) : (
                <Input
                  label="Giảm tối đa (VNĐ)"
                  type="number"
                  helperText="Để trống nếu không giới hạn."
                  inputProps={{ min: 1 }}
                  error={errors.maxDiscount}
                  {...register("maxDiscount", {
                    validate: (value) =>
                      value === "" || Number(value) > 0 || "Số tiền phải lớn hơn 0",
                  })}
                />
              )}
            </div>
          )}

          {(showProductScope || showCategoryScope) && (
            <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-800/60">
              {showProductScope ? (
                <Controller
                  name="productIds"
                  control={control}
                  rules={{
                    validate: (value) =>
                      value.length > 0 || "Vui lòng chọn ít nhất một sản phẩm",
                  }}
                  render={({ field, fieldState }) => (
                    <Autocomplete
                      multiple
                      options={products}
                      value={products.filter((item) => field.value.includes(item.id))}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      getOptionLabel={(option) => `${option.code} · ${option.name}`}
                      onChange={(_, values) => field.onChange(values.map((item) => item.id))}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Sản phẩm áp dụng"
                          error={Boolean(fieldState.error)}
                          helperText={fieldState.error?.message || "Có thể tìm và chọn nhiều sản phẩm."}
                        />
                      )}
                    />
                  )}
                />
              ) : (
                <Controller
                  name="categoryIds"
                  control={control}
                  rules={{
                    validate: (value) =>
                      value.length > 0 || "Vui lòng chọn ít nhất một danh mục",
                  }}
                  render={({ field, fieldState }) => (
                    <Autocomplete
                      multiple
                      options={categories}
                      value={categories.filter((item) => field.value.includes(item.id))}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      getOptionLabel={(option) => option.name}
                      onChange={(_, values) => field.onChange(values.map((item) => item.id))}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Danh mục áp dụng"
                          error={Boolean(fieldState.error)}
                          helperText={fieldState.error?.message || "Có thể chọn nhiều danh mục."}
                        />
                      )}
                    />
                  )}
                />
              )}
            </div>
          )}

          <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
            <Input
              label="Giá trị đơn tối thiểu (VNĐ)"
              type="number"
              inputProps={{ min: 0 }}
              error={errors.minOrderValue}
              {...register("minOrderValue", {
                min: { value: 0, message: "Không được nhỏ hơn 0" },
              })}
            />
            {type === "BUY_X_GET_Y" && (
              <Input
                label="Giảm tối đa (VNĐ)"
                type="number"
                helperText="Để trống nếu không giới hạn giá trị món tặng."
                inputProps={{ min: 1 }}
                error={errors.maxDiscount}
                {...register("maxDiscount", {
                  validate: (value) =>
                    value === "" || Number(value) > 0 || "Số tiền phải lớn hơn 0",
                })}
              />
            )}
            <Controller
              name="memberOnly"
              control={control}
              render={({ field }) => (
                <div className="tw-flex tw-h-10 tw-items-center tw-rounded-xl tw-border tw-border-slate-200 tw-px-3 dark:tw-border-slate-700">
                  <FormControlLabel
                    disabled={type === "MEMBER"}
                    control={<Switch checked={type === "MEMBER" || field.value} onChange={(_, value) => field.onChange(value)} />}
                    label="Chỉ dành cho hội viên trả phí còn hạn"
                  />
                </div>
              )}
            />
          </div>
        </section>

        <section className="tw-space-y-4 tw-border-t tw-border-slate-100 tw-pt-5 dark:tw-border-slate-800">
          <div className="tw-flex tw-items-center tw-gap-2">
            <span className="tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-bg-lavender-50 tw-text-lavender-700 dark:tw-bg-lavender-500/10">
              <TimerReset size={17} />
            </span>
            <div>
              <h3 className="tw-m-0 tw-text-sm tw-font-black">Thời gian và giới hạn sử dụng</h3>
              <p className="tw-mb-0 tw-mt-0.5 tw-text-xs tw-text-slate-400">Ưu đãi tự xuất hiện hoặc biến mất tại POS theo thời gian này.</p>
            </div>
          </div>
          <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
            <Input
              label="Bắt đầu"
              type="datetime-local"
              InputLabelProps={{ shrink: true }}
              error={errors.startAt}
              {...register("startAt", { required: "Vui lòng chọn thời gian bắt đầu" })}
            />
            <Input
              label="Kết thúc"
              type="datetime-local"
              InputLabelProps={{ shrink: true }}
              error={errors.endAt}
              {...register("endAt", {
                required: "Vui lòng chọn thời gian kết thúc",
                validate: (value) =>
                  new Date(value) > new Date(watch("startAt")) ||
                  "Thời gian kết thúc phải sau thời gian bắt đầu",
              })}
            />
            <Input
              label="Tổng lượt sử dụng"
              type="number"
              helperText="Để trống nếu không giới hạn."
              inputProps={{ min: 1 }}
              error={errors.totalUsageLimit}
              {...register("totalUsageLimit", {
                validate: (value) =>
                  value === "" || Number(value) > 0 || "Số lượt phải lớn hơn 0",
              })}
            />
            <Input
              label="Tối đa mỗi khách hàng"
              type="number"
              inputProps={{ min: 1 }}
              error={errors.usagePerCustomer}
              {...register("usagePerCustomer", {
                required: "Vui lòng nhập giới hạn mỗi khách",
                min: { value: 1, message: "Tối thiểu là 1" },
              })}
            />
          </div>
        </section>
      </form>
    </Modal>
  );
}
