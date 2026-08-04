import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import BrandLogo from "../../components/common/BrandLogo";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import api, { apiMessage } from "../../services/api";

function getTokenFromSearch(search) {
  return new URLSearchParams(search).get("token") || "";
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tokenFromUrl = useMemo(() => getTokenFromSearch(location.search), [location.search]);
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (token.trim().length < 32) {
      toast.error("Mã đặt lại mật khẩu không hợp lệ");
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error("Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token: token.trim(), newPassword });
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
        <p className="tw-mb-6 tw-text-sm tw-leading-6 tw-text-slate-500">
          Nhập mã nhận được và tạo mật khẩu mới cho tài khoản của bạn.
        </p>
        <form onSubmit={submit} className="tw-space-y-4">
          <Input label="Mã đặt lại mật khẩu" value={token} onChange={(event) => setToken(event.target.value)} inputProps={{ minLength: 32 }} />
          <Input label="Mật khẩu mới" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
          <Input label="Xác nhận mật khẩu mới" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
          <p className="tw-m-0 tw-text-xs tw-leading-5 tw-text-slate-400">Mật khẩu cần tối thiểu 8 ký tự, có chữ hoa, chữ thường và chữ số.</p>
          <Button type="submit" fullWidth loading={submitting}>Đặt lại mật khẩu</Button>
        </form>
        <Link to="/forgot-password" className="tw-mt-6 tw-block tw-text-center tw-font-bold tw-text-mint-700 tw-no-underline">Tạo mã mới</Link>
        <Link to="/login" className="tw-mt-3 tw-block tw-text-center tw-text-sm tw-font-bold tw-text-slate-400 tw-no-underline">Quay lại đăng nhập</Link>
      </div>
    </div>
  );
}
