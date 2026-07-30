import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Autocomplete,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
} from "@mui/material";
import { CalendarDays, Crown, Edit3, Gift, Plus, Power } from "lucide-react";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import StatusBadge from "../components/common/StatusBadge";
import { formatMoney } from "../utils/format";

function planForm(plan) {
  return {
    code: plan?.code || "",
    name: plan?.name || "",
    description: plan?.description || "",
    price: plan?.price ?? 399000,
    durationDays: plan?.durationDays ?? 30,
    dailyFreeQuantity: 1,
    benefitVariantId: plan?.benefitVariantId || "",
    isActive: plan?.isActive ?? true,
  };
}

function PlanDialog({ open, plan, products, loading, onClose, onSubmit }) {
  const {
    control,
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: planForm() });
  const variantOptions = products.flatMap((product) =>
    product.variants
      .filter((variant) => variant.isActive)
      .map((variant) => ({ ...variant, product })),
  );

  useEffect(() => {
    if (open) reset(planForm(plan));
  }, [open, plan, reset]);

  const submit = handleSubmit((values) =>
    onSubmit({
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      description: values.description.trim() || null,
      price: Number(values.price),
      durationDays: Number(values.durationDays),
      dailyFreeQuantity: 1,
      benefitVariantId: values.benefitVariantId,
      isActive: Boolean(values.isActive),
    }),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? "Chỉnh sửa gói hội viên" : "Tạo gói hội viên"}
      maxWidth="md"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose}>Hủy</Button>
          <Button onClick={submit} loading={loading}>Lưu gói hội viên</Button>
        </>
      }
    >
      <div className="tw-grid tw-gap-4 tw-pt-2 sm:tw-grid-cols-2">
        <Input
          label="Mã gói"
          error={errors.code}
          {...register("code", {
            required: "Vui lòng nhập mã gói",
            onChange: (event) => setValue("code", event.target.value.toUpperCase()),
          })}
        />
        <Input
          label="Tên gói"
          error={errors.name}
          {...register("name", { required: "Vui lòng nhập tên gói" })}
        />
        <Input
          label="Phí đăng ký (VNĐ)"
          type="number"
          inputProps={{ min: 0 }}
          error={errors.price}
          {...register("price", {
            required: "Vui lòng nhập mức phí",
            min: { value: 0, message: "Mức phí không hợp lệ" },
          })}
        />
        <Input
          label="Thời hạn (ngày)"
          type="number"
          inputProps={{ min: 1, max: 3650 }}
          error={errors.durationDays}
          {...register("durationDays", {
            required: "Vui lòng nhập thời hạn",
            min: { value: 1, message: "Tối thiểu 1 ngày" },
          })}
        />
        <div className="sm:tw-col-span-2">
          <Input label="Mô tả quyền lợi" multiline rows={2} {...register("description")} />
        </div>
        <div className="sm:tw-col-span-2">
          <Controller
            name="benefitVariantId"
            control={control}
            rules={{ required: "Vui lòng chọn sản phẩm quà tặng cố định" }}
            render={({ field, fieldState }) => (
              <Autocomplete
                options={variantOptions}
                value={variantOptions.find((item) => item.id === field.value) || null}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                getOptionLabel={(option) =>
                  `${option.product.code} · ${option.product.name} — ${option.name} · ${formatMoney(option.price)}`
                }
                onChange={(_, value) => field.onChange(value?.id || "")}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Sản phẩm quà tặng cố định"
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message || "Chọn chính xác sản phẩm và biến thể B được miễn phí một đơn vị mỗi ngày."}
                  />
                )}
              />
            )}
          />
        </div>
        <Controller
          name="isActive"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Switch checked={field.value} onChange={(_, value) => field.onChange(value)} />}
              label={field.value ? "Đang mở đăng ký" : "Tạm ngừng đăng ký"}
            />
          )}
        />
      </div>
    </Modal>
  );
}

export default function MembershipPlansPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const plansQuery = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => api.get("/memberships/plans").then((response) => response.data.data),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "membership-options"],
    queryFn: () =>
      api
        .get("/products", { params: { status: "ACTIVE", size: 100 } })
        .then((response) => response.data.data),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["membership-plans"] });
    queryClient.invalidateQueries({ queryKey: ["membership-plans", "active"] });
  };
  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing
        ? api.put(`/memberships/plans/${editing.id}`, values)
        : api.post("/memberships/plans", values),
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật gói hội viên" : "Đã tạo gói hội viên");
      refresh();
      setOpen(false);
      setEditing(null);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const statusMutation = useMutation({
    mutationFn: (plan) =>
      api.patch(`/memberships/plans/${plan.id}/status`, { isActive: !plan.isActive }),
    onSuccess: (response) => {
      toast.success(response.data.message);
      refresh();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const plans = plansQuery.data || [];
  const columns = [
    {
      key: "name",
      label: "Gói hội viên",
      render: (value, row) => (
        <div>
          <strong className="tw-block tw-text-sm">{value}</strong>
          <span className="tw-text-xs tw-text-slate-400">{row.code}</span>
        </div>
      ),
    },
    {
      key: "price",
      label: "Phí đăng ký",
      align: "right",
      render: (value) => <strong>{formatMoney(value)}</strong>,
    },
    {
      key: "durationDays",
      label: "Thời hạn",
      render: (value) => `${value} ngày`,
    },
    {
      key: "benefitVariant",
      label: "Quyền lợi",
      render: (value) => (
        <div>
          <strong className="tw-block tw-text-sm">{value?.product?.name || "Chưa cấu hình"}</strong>
          <span className="tw-text-xs tw-text-slate-400">
            {value ? `${value.name} · miễn phí 1/ngày` : "Cần chọn quà tặng"}
          </span>
        </div>
      ),
    },
    {
      key: "_count",
      label: "Đã đăng ký",
      align: "right",
      render: (value) => value.subscriptions.toLocaleString("vi-VN"),
    },
    {
      key: "isActive",
      label: "Trạng thái",
      render: (value) => <StatusBadge status={value ? "ACTIVE" : "INACTIVE"} />,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (_, row) => (
        <div className="tw-whitespace-nowrap">
          <IconButton onClick={() => { setEditing(row); setOpen(true); }} aria-label="Sửa gói">
            <Edit3 size={17} />
          </IconButton>
          <IconButton
            onClick={() => statusMutation.mutate(row)}
            color={row.isActive ? "error" : "success"}
            aria-label={row.isActive ? "Ngừng bán" : "Mở bán"}
          >
            <Power size={17} />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Khách hàng thân thiết"
        title="Gói hội viên"
        description="Cấu hình phí, thời hạn và một sản phẩm quà tặng cố định được miễn phí mỗi ngày."
        actions={
          <Button
            startIcon={<Plus size={18} />}
            onClick={() => { setEditing(null); setOpen(true); }}
          >
            Tạo gói hội viên
          </Button>
        }
      />
      <div className="tw-grid tw-gap-3 sm:tw-grid-cols-3">
        <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
          <Crown className="tw-mb-3 tw-text-mint-700" size={20} />
          <strong className="tw-block tw-text-2xl">{plans.filter((item) => item.isActive).length}</strong>
          <span className="tw-text-xs tw-text-slate-400">Gói đang mở đăng ký</span>
        </div>
        <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
          <CalendarDays className="tw-mb-3 tw-text-lavender-500" size={20} />
          <strong className="tw-block tw-text-2xl">30 ngày</strong>
          <span className="tw-text-xs tw-text-slate-400">Thời hạn gợi ý</span>
        </div>
        <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
          <Gift className="tw-mb-3 tw-text-amber-500" size={20} />
          <strong className="tw-block tw-text-2xl">1 món/ngày</strong>
          <span className="tw-text-xs tw-text-slate-400">Backend kiểm soát lượt nhận</span>
        </div>
      </div>
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <DataTable columns={columns} rows={plans} loading={plansQuery.isLoading} />
      </div>
      <PlanDialog
        open={open}
        plan={editing}
        products={productsQuery.data || []}
        loading={saveMutation.isPending}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSubmit={(values) => saveMutation.mutate(values)}
      />
    </div>
  );
}
