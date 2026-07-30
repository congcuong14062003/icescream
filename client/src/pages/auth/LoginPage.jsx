import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  ShoppingBag,
} from "lucide-react";
import { IconButton, InputAdornment } from "@mui/material";
import { toast } from "react-toastify";
import BrandLogo from "../../components/common/BrandLogo";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { useAuth } from "../../store/AuthContext";
import { apiMessage } from "../../services/api";

const demos = [
  { label: "Thu ngân", login: "cashier", accent: "tw-bg-emerald-500" },
  { label: "Quản lý", login: "manager", accent: "tw-bg-violet-500" },
  { label: "Quản trị", login: "admin", accent: "tw-bg-slate-800" },
  { label: "Nhân viên kho", login: "warehouse", accent: "tw-bg-amber-500" },
];

const capabilities = [
  { icon: ShoppingBag, label: "POS tại quầy", value: "Nhanh & chính xác" },
  { icon: Boxes, label: "Kho nguyên liệu", value: "Theo lô, công thức" },
  { icon: BarChart3, label: "Báo cáo", value: "Dữ liệu thời gian thực" },
];

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { login: "cashier", password: "IceCream@123" },
  });

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const submit = async (values) => {
    try {
      const nextUser = await login(values);
      toast.success(`Chào ${nextUser.fullName}!`);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (error) {
      toast.error(apiMessage(error, "Đăng nhập thất bại"));
    }
  };

  const chooseDemo = (account) => {
    setValue("login", account.login, { shouldValidate: true });
    setValue("password", "IceCream@123", { shouldValidate: true });
  };

  return (
    <div className="tw-grid tw-min-h-screen tw-bg-[#f3f6f5] lg:tw-grid-cols-[minmax(520px,1.08fr)_minmax(430px,0.92fr)] dark:tw-bg-[#0b1211]">
      <section className="professional-grid tw-relative tw-hidden tw-overflow-hidden tw-bg-[#0a3029] tw-p-10 tw-text-white lg:tw-flex lg:tw-flex-col xl:tw-p-14">
        <div className="tw-relative tw-z-10 tw-flex tw-items-center tw-justify-between">
          <BrandLogo light />
          <span className="tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-white/10 tw-bg-white/5 tw-px-3 tw-py-2 tw-text-[11px] tw-font-bold tw-text-white/70">
            <span className="tw-h-2 tw-w-2 tw-rounded-full tw-bg-emerald-400 tw-shadow-[0_0_0_5px_rgba(52,211,153,0.1)]" />
            Store OS v1.0
          </span>
        </div>

        <div className="tw-relative tw-z-10 tw-my-auto tw-max-w-[660px]">
          <div className="tw-mb-6 tw-flex tw-items-center tw-gap-2 tw-text-xs tw-font-bold tw-uppercase tw-tracking-[0.16em] tw-text-mint-300">
            <span className="tw-h-px tw-w-8 tw-bg-mint-400" />
            Nền tảng vận hành cửa hàng
          </div>
          <h1 className="tw-m-0 tw-max-w-[640px] tw-text-[46px] tw-font-extrabold tw-leading-[1.08] tw-tracking-[-0.045em] xl:tw-text-[58px]">
            Bán hàng gọn hơn.
            <span className="tw-block tw-text-mint-300">Quản lý thông minh hơn.</span>
          </h1>
          <p className="tw-mb-0 tw-mt-6 tw-max-w-xl tw-text-[16px] tw-leading-7 tw-text-white/60">
            Từ order tại quầy đến tồn kho, khách hàng và doanh thu — tất cả được kiểm soát trong một hệ thống dành riêng cho cửa hàng kem.
          </p>

          <div className="tw-mt-10 tw-grid tw-grid-cols-3 tw-gap-3">
            {capabilities.map(({ icon: Icon, label, value }) => (
              <div key={label} className="tw-rounded-2xl tw-border tw-border-white/[0.09] tw-bg-white/[0.055] tw-p-4 tw-backdrop-blur">
                <div className="tw-mb-5 tw-flex tw-h-9 tw-w-9 tw-items-center tw-justify-center tw-rounded-lg tw-bg-mint-400/15 tw-text-mint-200">
                  <Icon size={18} />
                </div>
                <strong className="tw-block tw-text-xs tw-font-bold">{label}</strong>
                <span className="tw-mt-1 tw-block tw-text-[10px] tw-leading-4 tw-text-white/40">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="tw-relative tw-z-10 tw-flex tw-items-center tw-gap-2 tw-text-[11px] tw-text-white/35">
          <CheckCircle2 size={14} className="tw-text-mint-300" />
          Dữ liệu lưu cục bộ an toàn với SQLite · Phân quyền theo nghiệp vụ
        </div>
        <div className="tw-absolute -tw-bottom-40 -tw-right-24 tw-h-96 tw-w-96 tw-rounded-full tw-bg-mint-400/[0.07] tw-blur-3xl" />
      </section>

      <section className="tw-flex tw-items-center tw-justify-center tw-p-5 sm:tw-p-10 xl:tw-p-14">
        <div className="tw-w-full tw-max-w-[440px]">
          <div className="tw-mb-10 lg:tw-hidden">
            <BrandLogo />
          </div>

          <div className="tw-mb-8">
            <span className="tw-text-xs tw-font-bold tw-uppercase tw-tracking-[0.14em] tw-text-mint-600">Đăng nhập hệ thống</span>
            <h2 className="tw-mb-0 tw-mt-3 tw-text-[34px] tw-font-extrabold tw-tracking-[-0.04em] tw-text-slate-950 dark:tw-text-white">
              Chào mừng trở lại
            </h2>
            <p className="tw-mb-0 tw-mt-2 tw-text-sm tw-leading-6 tw-text-slate-500 dark:tw-text-slate-400">
              Truy cập không gian làm việc của cửa hàng.
            </p>
          </div>

          <form onSubmit={handleSubmit(submit)} className="tw-space-y-4">
            <Input
              label="Tên đăng nhập hoặc email"
              autoComplete="username"
              error={errors.login}
              {...register("login", { required: "Vui lòng nhập tài khoản" })}
            />
            <Input
              label="Mật khẩu"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              error={errors.password}
              {...register("password", { required: "Vui lòng nhập mật khẩu" })}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((value) => !value)}
                      edge="end"
                      aria-label="Hiện hoặc ẩn mật khẩu"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <div className="tw-flex tw-items-center tw-justify-between">
              <span className="tw-text-xs tw-text-slate-400">Mật khẩu demo: IceCream@123</span>
              <Link to="/forgot-password" className="tw-text-xs tw-font-bold tw-text-mint-700 tw-no-underline hover:tw-text-mint-600">
                Quên mật khẩu?
              </Link>
            </div>
            <Button type="submit" fullWidth size="large" loading={isSubmitting} endIcon={<ArrowRight size={17} />}>
              Đăng nhập
            </Button>
          </form>

          <div className="tw-my-7 tw-flex tw-items-center tw-gap-3 tw-text-[10px] tw-font-bold tw-uppercase tw-tracking-[0.12em] tw-text-slate-400">
            <span className="tw-h-px tw-flex-1 tw-bg-slate-200 dark:tw-bg-slate-700" />
            Truy cập nhanh
            <span className="tw-h-px tw-flex-1 tw-bg-slate-200 dark:tw-bg-slate-700" />
          </div>

          <div className="tw-grid tw-grid-cols-2 tw-gap-2.5">
            {demos.map((account) => (
              <button
                type="button"
                key={account.login}
                onClick={() => chooseDemo(account)}
                className="tw-group tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-px-3 tw-py-3 tw-text-left tw-text-xs tw-font-bold tw-text-slate-600 tw-transition hover:tw-border-mint-300 hover:tw-shadow-sm dark:tw-border-slate-700 dark:tw-bg-slate-900 dark:tw-text-slate-200"
              >
                <span className={`tw-h-2 tw-w-2 tw-rounded-full ${account.accent}`} />
                <span className="tw-flex-1">{account.label}</span>
                <ArrowRight size={13} className="tw-text-slate-300 tw-transition group-hover:tw-translate-x-0.5 group-hover:tw-text-mint-600" />
              </button>
            ))}
          </div>

          <p className="tw-mb-0 tw-mt-8 tw-text-center tw-text-[11px] tw-text-slate-400">
            IceCream POS · Hệ thống quản lý cửa hàng chuyên nghiệp
          </p>
        </div>
      </section>
    </div>
  );
}
