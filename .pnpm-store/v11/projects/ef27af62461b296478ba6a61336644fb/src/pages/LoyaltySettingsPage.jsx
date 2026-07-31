import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormControlLabel, Switch } from "@mui/material";
import { Award, Edit3, Gift, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import { formatMoney } from "../utils/format";

function formValues(level) {
  return {
    minPoints: level?.minPoints ?? 0,
    pointRate: level?.pointRate ?? 1,
    voucherEnabled: level?.voucherEnabled ?? false,
    voucherType: level?.voucherType || "FIXED_AMOUNT",
    voucherValue: level?.voucherValue ?? 0,
    voucherMaxDiscount: level?.voucherMaxDiscount ?? "",
    voucherMinOrderValue: level?.voucherMinOrderValue ?? 0,
    voucherValidityDays: level?.voucherValidityDays ?? 15,
    voucherCooldownDays: level?.voucherCooldownDays ?? 15,
    voucherRenewalOrderMinAmount:
      level?.voucherRenewalOrderMinAmount ?? 200000,
  };
}

function LevelDialog({ level, open, loading, onClose, onSave }) {
  const {
    control,
    register,
    reset,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: formValues() });
  const enabled = watch("voucherEnabled");
  const type = watch("voucherType");

  useEffect(() => {
    if (open) reset(formValues(level));
  }, [level, open, reset]);

  const submit = handleSubmit((values) =>
    onSave({
      ...values,
      minPoints: Number(values.minPoints),
      pointRate: Number(values.pointRate),
      voucherEnabled: Boolean(values.voucherEnabled),
      voucherValue: Number(values.voucherValue),
      voucherMaxDiscount:
        values.voucherMaxDiscount === "" ? null : Number(values.voucherMaxDiscount),
      voucherMinOrderValue: Number(values.voucherMinOrderValue),
      voucherValidityDays: Number(values.voucherValidityDays),
      voucherCooldownDays: Number(values.voucherCooldownDays),
      voucherRenewalOrderMinAmount: Number(
        values.voucherRenewalOrderMinAmount,
      ),
    }),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Cấu hình hạng ${level?.name || ""}`}
      maxWidth="md"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose}>Hủy</Button>
          <Button loading={loading} onClick={submit}>Lưu cấu hình</Button>
        </>
      }
    >
      <div className="tw-space-y-5 tw-pt-2">
        <div className="tw-rounded-2xl tw-border tw-border-mint-200 tw-bg-mint-50 tw-p-4 dark:tw-border-mint-800 dark:tw-bg-mint-900/20">
          <div className="tw-flex tw-items-center tw-gap-2 tw-font-black tw-text-mint-800 dark:tw-text-mint-200">
            <Award size={18} /> Tích điểm và lên hạng
          </div>
          <div className="tw-mt-3 tw-grid tw-gap-4 sm:tw-grid-cols-2">
            <Input
              label="Mốc điểm để đạt hạng"
              type="number"
              inputProps={{ min: 0 }}
              error={errors.minPoints}
              {...register("minPoints", {
                required: "Vui lòng nhập mốc điểm",
                min: { value: 0, message: "Mốc điểm không hợp lệ" },
              })}
            />
            <Input
              label="Điểm nhận trên mỗi 10.000đ"
              type="number"
              inputProps={{ min: 0, step: 0.1 }}
              helperText="Điểm chỉ dùng để xét hạng, không đổi thành tiền."
              error={errors.pointRate}
              {...register("pointRate", {
                required: "Vui lòng nhập tỷ lệ điểm",
                min: { value: 0, message: "Tỷ lệ điểm không hợp lệ" },
              })}
            />
          </div>
        </div>

        <Controller
          name="voucherEnabled"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  onChange={(_, value) => field.onChange(value)}
                />
              }
              label="Tự động cấp voucher cho hạng này"
            />
          )}
        />

        <div className={`tw-grid tw-gap-4 sm:tw-grid-cols-2 ${enabled ? "" : "tw-pointer-events-none tw-opacity-45"}`}>
          <Controller
            name="voucherType"
            control={control}
            render={({ field }) => (
              <Select
                label="Loại voucher"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "FIXED_AMOUNT", label: "Giảm số tiền" },
                  { value: "PERCENT", label: "Giảm phần trăm" },
                ]}
              />
            )}
          />
          <Input
            label={type === "PERCENT" ? "Mức giảm (%)" : "Mức giảm (VNĐ)"}
            type="number"
            inputProps={{ min: 0, max: type === "PERCENT" ? 100 : undefined }}
            error={errors.voucherValue}
            {...register("voucherValue", {
              min: { value: 0, message: "Giá trị không hợp lệ" },
              max:
                type === "PERCENT"
                  ? { value: 100, message: "Tối đa 100%" }
                  : undefined,
            })}
          />
          <Input
            label="Giảm tối đa (VNĐ)"
            type="number"
            inputProps={{ min: 1 }}
            helperText="Để trống nếu không giới hạn."
            {...register("voucherMaxDiscount")}
          />
          <Input
            label="Giá trị đơn tối thiểu để dùng (VNĐ)"
            type="number"
            inputProps={{ min: 0 }}
            {...register("voucherMinOrderValue")}
          />
          <Input
            label="Hạn sử dụng voucher (ngày)"
            type="number"
            inputProps={{ min: 1 }}
            {...register("voucherValidityDays", { min: 1 })}
          />
          <Input
            label="Thời gian chờ sau khi dùng (ngày)"
            type="number"
            inputProps={{ min: 0 }}
            {...register("voucherCooldownDays", { min: 0 })}
          />
          <div className="sm:tw-col-span-2">
            <Input
              label="Hóa đơn tối thiểu để nhận voucher tiếp (VNĐ)"
              type="number"
              inputProps={{ min: 0 }}
              helperText="Chỉ cấp lại khi đã qua thời gian chờ và đơn hoàn thành đạt mức này."
              {...register("voucherRenewalOrderMinAmount", { min: 0 })}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function LoyaltySettingsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const levelsQuery = useQuery({
    queryKey: ["membership-levels"],
    queryFn: () =>
      api.get("/memberships/levels").then((response) => response.data.data),
  });
  const saveMutation = useMutation({
    mutationFn: (values) =>
      api.put(`/memberships/levels/${editing.id}`, values),
    onSuccess: () => {
      toast.success("Đã lưu chính sách điểm và voucher");
      queryClient.invalidateQueries({ queryKey: ["membership-levels"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setEditing(null);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const columns = [
    {
      key: "name",
      label: "Hạng khách hàng",
      render: (value, row) => (
        <div className="tw-flex tw-items-center tw-gap-3">
          <span className="tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-xl tw-bg-amber-50 tw-text-amber-600 dark:tw-bg-amber-500/10">
            <Award size={20} />
          </span>
          <div>
            <strong className="tw-block">{value}</strong>
            <span className="tw-text-xs tw-text-slate-400">
              {row._count.customers.toLocaleString("vi-VN")} khách hàng
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "minPoints",
      label: "Mốc lên hạng",
      align: "right",
      render: (value) => <strong>{value.toLocaleString("vi-VN")} điểm</strong>,
    },
    {
      key: "pointRate",
      label: "Tốc độ tích",
      render: (value) => `${value} điểm / 10.000đ`,
    },
    {
      key: "voucherEnabled",
      label: "Voucher",
      render: (value, row) =>
        value ? (
          <div>
            <strong className="tw-text-mint-700">
              {row.voucherType === "PERCENT"
                ? `${row.voucherValue}%`
                : formatMoney(row.voucherValue)}
            </strong>
            <span className="tw-block tw-text-xs tw-text-slate-400">
              Hạn {row.voucherValidityDays} ngày · chờ {row.voucherCooldownDays} ngày
            </span>
          </div>
        ) : (
          <span className="tw-text-sm tw-text-slate-400">Không cấp</span>
        ),
    },
    {
      key: "voucherRenewalOrderMinAmount",
      label: "Đơn để nhận lại",
      align: "right",
      render: (value, row) => (row.voucherEnabled ? formatMoney(value) : "—"),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (_, row) => (
        <Button
          variant="outlined"
          size="small"
          startIcon={<Edit3 size={15} />}
          onClick={() => setEditing(row)}
        >
          Cấu hình
        </Button>
      ),
    },
  ];

  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Loyalty automation"
        title="Hạng khách hàng & voucher"
        description="Điểm chỉ dùng để lên hạng. Voucher được cấp tự động khi lên hạng và cấp lại theo thời gian chờ cùng giá trị hóa đơn đã cấu hình."
      />
      <div className="tw-grid tw-gap-3 md:tw-grid-cols-3">
        {[
          [Sparkles, "Lên hạng", "Tự cấp voucher lần đầu khi khách đạt mốc điểm mới."],
          [ShieldCheck, "Chống cấp trùng", "Voucher đang hiệu lực hoặc còn thời gian chờ sẽ chặn cấp mới."],
          [Gift, "Cấp lại", "Qua thời gian chờ, đơn đạt mức tối thiểu sẽ sinh voucher tiếp."],
        ].map(([Icon, title, text]) => (
          <div key={title} className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
            <Icon size={20} className="tw-text-mint-600" />
            <strong className="tw-mt-3 tw-block tw-text-sm">{title}</strong>
            <p className="tw-mb-0 tw-mt-1 tw-text-xs tw-leading-5 tw-text-slate-500">{text}</p>
          </div>
        ))}
      </div>
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <DataTable
          columns={columns}
          rows={levelsQuery.data || []}
          loading={levelsQuery.isLoading}
        />
      </div>
      <LevelDialog
        level={editing}
        open={Boolean(editing)}
        loading={saveMutation.isPending}
        onClose={() => setEditing(null)}
        onSave={(values) => saveMutation.mutate(values)}
      />
    </div>
  );
}
