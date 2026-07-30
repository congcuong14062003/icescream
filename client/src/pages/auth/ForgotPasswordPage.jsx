import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import BrandLogo from "../../components/common/BrandLogo";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import api, { apiMessage } from "../../services/api";

export default function ForgotPasswordPage() {
  const [debugToken, setDebugToken] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const submit = async (values) => {
    try {
      const response = await api.post("/auth/forgot-password", values);
      setDebugToken(response.data.data.debugToken || "");
      toast.success(response.data.message);
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };
  return (
    <div className="ice-gradient tw-flex tw-min-h-screen tw-items-center tw-justify-center tw-p-5">
      <div className="tw-w-full tw-max-w-md tw-rounded-4xl tw-bg-white tw-p-8 tw-shadow-soft dark:tw-bg-slate-900">
        <BrandLogo />
        <h1 className="tw-mb-2 tw-mt-8 tw-text-3xl tw-font-black">Quên mật khẩu</h1>
        <p className="tw-mb-6 tw-text-sm tw-text-slate-500">
          Nhập tên đăng nhập hoặc email. Trong môi trường phát triển, mã đặt lại sẽ hiển thị ngay bên dưới.
        </p>
        <form onSubmit={handleSubmit(submit)} className="tw-space-y-4">
          <Input label="Tên đăng nhập hoặc email" error={errors.login} {...register("login", { required: "Vui lòng nhập tài khoản" })} />
          <Button type="submit" fullWidth loading={isSubmitting}>Tạo liên kết đặt lại</Button>
        </form>
        {debugToken && (
          <div className="tw-mt-5 tw-rounded-2xl tw-bg-mint-50 tw-p-4 tw-text-sm dark:tw-bg-mint-700/20">
            <strong>Mã phát triển:</strong>
            <div className="tw-mt-2 tw-break-all tw-font-mono tw-text-xs">{debugToken}</div>
          </div>
        )}
        <Link to="/login" className="tw-mt-6 tw-block tw-text-center tw-font-bold tw-text-mint-700 tw-no-underline">Quay lại đăng nhập</Link>
      </div>
    </div>
  );
}

