import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import BrandLogo from "../../components/common/BrandLogo";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import api, { apiMessage } from "../../services/api";

function searchValue(search, key) {
  return new URLSearchParams(search).get(key) || "";
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialLogin = useMemo(() => searchValue(location.search, "login"), [location.search]);
  const [login, setLogin] = useState(initialLogin);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (login.trim().length < 3) return toast.error("Vui lòng nhập tên đăng nhập hoặc email");
    if (!/^\d{6}$/.test(otp.trim())) return toast.error("Mã OTP phải gồm đúng 6 chữ số");
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return toast.error("Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số");
    }
    if (newPassword !== confirmPassword) return toast.error("Mật khẩu xác nhận không khớp");

    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { login: login.trim(), otp: otp.trim(), newPassword });
      toast.success("Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ice-gradient tw-flex tw-min-h-screen tw-items-center tw-justify-center tw-p-5">
      <div className="tw-w-full tw-max-w-md tw-rounded-4xl tw-bg-white tw-p-8 tw-shadow-soft dark:tw-bg-slate-900">
        <BrandLogo />
        <h1 className="tw-mb-2 tw-mt-8 tw-text-3xl tw-font-black">Đặt lại mật khẩu</h1>
        <p className="tw-mb-6 tw-text-sm tw-leading-6 tw-text-slate-500">Nhập mã OTP 6 số nhận được qua email. Mã có hiệu lực trong 10 phút.</p>
        <form onSubmit={submit} className="tw-space-y-4">
          <Input label="Tên đăng nhập hoặc email" value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" />
          <Input label="Mã OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" inputProps={{ maxLength: 6 }} />
          <Input label="Mật khẩu mới" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
          <Input label="Xác nhận mật khẩu mới" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
          <p className="tw-m-0 tw-text-xs tw-leading-5 tw-text-slate-400">Mật khẩu cần tối thiểu 8 ký tự, có chữ hoa, chữ thường và chữ số.</p>
          <Button type="submit" fullWidth loading={submitting}>Đặt lại mật khẩu</Button>
        </form>
        <Link to="/forgot-password" className="tw-mt-6 tw-block tw-text-center tw-font-bold tw-text-mint-700 tw-no-underline">Gửi lại mã OTP</Link>
        <Link to="/login" className="tw-mt-3 tw-block tw-text-center tw-text-sm tw-font-bold tw-text-slate-400 tw-no-underline">Quay lại đăng nhập</Link>
      </div>
    </div>
  );
}
