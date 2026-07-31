import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Crown, Gift, WalletCards } from "lucide-react";
import { toast } from "react-toastify";
import api, { apiMessage } from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import LoadingSkeleton from "../../components/common/LoadingSkeleton";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import { formatMoney, paymentMethodLabels } from "../../utils/format";

const paymentOptions = Object.entries(paymentMethodLabels)
  .filter(([value]) => value !== "MIXED")
  .map(([value, label]) => ({ value, label }));

export default function MembershipEnrollDialog({
  open,
  customer,
  onClose,
  onSuccess,
}) {
  const queryClient = useQueryClient();
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      membershipPlanId: "",
      paymentMethod: "CASH",
      referenceCode: "",
      note: "",
    },
  });
  const plansQuery = useQuery({
    queryKey: ["membership-plans", "active"],
    queryFn: () =>
      api
        .get("/memberships/plans", { params: { active: true } })
        .then((response) => response.data.data),
    enabled: open,
  });
  const plans = plansQuery.data || [];
  const planId = watch("membershipPlanId");
  const paymentMethod = watch("paymentMethod");
  const selectedPlan = plans.find((item) => item.id === planId);

  useEffect(() => {
    if (!open) return;
    reset({
      membershipPlanId: plans[0]?.id || "",
      paymentMethod: "CASH",
      referenceCode: "",
      note: "",
    });
  }, [open, plansQuery.data, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await api.post("/memberships/subscriptions", {
        customerId: customer.id,
        membershipPlanId: values.membershipPlanId,
        paymentMethod: values.paymentMethod,
        referenceCode: values.referenceCode.trim() || null,
        note: values.note.trim() || null,
      });
      const customerResponse = await api.get(`/customers/${customer.id}`);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
      queryClient.invalidateQueries({ queryKey: ["membership-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["membership-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["current-shift"] });
      toast.success(
        customer.activeMembership
          ? "Đã gia hạn hội viên thành công"
          : "Đã đăng ký hội viên thành công",
      );
      onSuccess?.(customerResponse.data.data);
      onClose();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer?.activeMembership ? "Gia hạn hội viên" : "Đăng ký hội viên"}
      maxWidth="sm"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose}>Hủy</Button>
          <Button
            onClick={submit}
            loading={isSubmitting}
            disabled={!selectedPlan}
            startIcon={<Crown size={17} />}
          >
            Thu phí và kích hoạt
          </Button>
        </>
      }
    >
      {plansQuery.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="tw-space-y-4 tw-pt-2">
          <div className="tw-rounded-2xl tw-border tw-border-mint-200 tw-bg-mint-50 tw-p-4 dark:tw-border-mint-800 dark:tw-bg-mint-900/20">
            <div className="tw-flex tw-items-center tw-gap-3">
              <span className="tw-flex tw-h-11 tw-w-11 tw-items-center tw-justify-center tw-rounded-xl tw-bg-white tw-text-mint-700 tw-shadow-sm dark:tw-bg-slate-900">
                <Crown size={22} />
              </span>
              <div>
                <strong className="tw-block tw-text-sm">{customer?.fullName}</strong>
                <span className="tw-text-xs tw-text-slate-500">{customer?.phone}</span>
              </div>
            </div>
            {customer?.activeMembership && (
              <p className="tw-mb-0 tw-mt-3 tw-text-xs tw-font-semibold tw-text-mint-800 dark:tw-text-mint-200">
                Gói mới sẽ tự động nối tiếp sau ngày hết hạn của gói hiện tại.
              </p>
            )}
          </div>

          <Controller
            name="membershipPlanId"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                label="Gói hội viên"
                options={plans.map((plan) => ({
                  value: plan.id,
                  label: `${plan.name} · ${formatMoney(plan.price)}`,
                }))}
                {...field}
              />
            )}
          />

          {selectedPlan && (
            <>
              <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                <div className="tw-rounded-xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800">
                  <WalletCards size={16} className="tw-mb-2 tw-text-mint-700" />
                  <strong className="tw-block tw-text-sm">{formatMoney(selectedPlan.price)}</strong>
                  <span className="tw-text-[10px] tw-text-slate-400">Phí đăng ký</span>
                </div>
                <div className="tw-rounded-xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800">
                  <CalendarDays size={16} className="tw-mb-2 tw-text-lavender-500" />
                  <strong className="tw-block tw-text-sm">{selectedPlan.durationDays} ngày</strong>
                  <span className="tw-text-[10px] tw-text-slate-400">Thời hạn</span>
                </div>
                <div className="tw-rounded-xl tw-bg-slate-50 tw-p-3 dark:tw-bg-slate-800">
                  <Gift size={16} className="tw-mb-2 tw-text-amber-500" />
                  <strong className="tw-block tw-text-sm">1 món/ngày</strong>
                  <span className="tw-text-[10px] tw-text-slate-400">Quyền lợi</span>
                </div>
              </div>
              <div className="tw-rounded-xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-p-3 tw-text-xs dark:tw-border-amber-800 dark:tw-bg-amber-900/20">
                <strong className="tw-block tw-text-amber-800 dark:tw-text-amber-200">Quà tặng cố định</strong>
                <span className="tw-text-slate-600 dark:tw-text-slate-300">
                  {selectedPlan.benefitVariant
                    ? `${selectedPlan.benefitVariant.product.name} — ${selectedPlan.benefitVariant.name}`
                    : "Gói chưa được cấu hình sản phẩm quà tặng"}
                </span>
              </div>
            </>
          )}

          <Controller
            name="paymentMethod"
            control={control}
            render={({ field }) => (
              <Select label="Phương thức thu phí" options={paymentOptions} {...field} />
            )}
          />
          {paymentMethod !== "CASH" && (
            <Input label="Mã giao dịch" {...register("referenceCode")} />
          )}
          <Input label="Ghi chú" multiline rows={2} {...register("note")} />
          <p className="tw-m-0 tw-text-xs tw-text-slate-400">
            Mức phí và thời hạn được backend lấy từ cấu hình gói; nhân viên không thể sửa số tiền khi thu.
          </p>
        </div>
      )}
    </Modal>
  );
}
