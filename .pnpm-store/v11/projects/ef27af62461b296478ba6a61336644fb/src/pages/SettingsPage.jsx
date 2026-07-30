import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { LockKeyhole, Moon, Save, Sun, UserRound } from "lucide-react";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import PageHeader from "../components/common/PageHeader";
import UploadImage from "../components/common/UploadImage";
import { useAuth } from "../store/AuthContext";
import { useColorMode } from "../store/ColorModeContext";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { mode, toggleMode } = useColorMode();
  const profile = useForm();
  const password = useForm();
  useEffect(() => {
    profile.reset({ fullName: user.fullName, phone: user.phone || "", avatarUrl: user.avatarUrl || "" });
  }, [user, profile]);
  const saveProfile = async (values) => {
    try {
      await api.put("/auth/profile", { ...values, avatarUrl: values.avatarUrl || null });
      await refreshUser();
      toast.success("Đã cập nhật hồ sơ");
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };
  const changePassword = async (values) => {
    if (values.newPassword !== values.confirmPassword) return toast.error("Mật khẩu xác nhận không khớp");
    try {
      await api.post("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success("Đổi mật khẩu thành công, vui lòng đăng nhập lại");
      window.dispatchEvent(new Event("icecream:session-expired"));
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };
  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader eyebrow="Cá nhân hóa" title="Tài khoản & cài đặt" description="Quản lý hồ sơ, mật khẩu và giao diện của riêng bạn." />
      <div className="tw-grid tw-gap-5 xl:tw-grid-cols-2">
        <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-6 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
          <h3 className="tw-mb-5 tw-mt-0 tw-flex tw-items-center tw-gap-2 tw-text-lg tw-font-black"><UserRound size={20} /> Hồ sơ cá nhân</h3>
          <form onSubmit={profile.handleSubmit(saveProfile)} className="tw-space-y-4">
            <UploadImage value={profile.watch("avatarUrl")} onChange={(value) => profile.setValue("avatarUrl", value)} />
            <Input label="Họ và tên" {...profile.register("fullName", { required: true })} />
            <Input label="Số điện thoại" {...profile.register("phone")} />
            <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-3 tw-text-sm dark:tw-bg-slate-800">
              <div>Email: <strong>{user.email}</strong></div>
              <div className="tw-mt-1">Vai trò: <strong>{user.role.name}</strong></div>
            </div>
            <Button type="submit" loading={profile.formState.isSubmitting} startIcon={<Save size={17} />}>Lưu hồ sơ</Button>
          </form>
        </section>
        <section className="tw-space-y-5">
          <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-6 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
            <h3 className="tw-mb-5 tw-mt-0 tw-flex tw-items-center tw-gap-2 tw-text-lg tw-font-black"><LockKeyhole size={20} /> Đổi mật khẩu</h3>
            <form onSubmit={password.handleSubmit(changePassword)} className="tw-space-y-4">
              <Input label="Mật khẩu hiện tại" type="password" {...password.register("currentPassword", { required: true })} />
              <Input label="Mật khẩu mới" type="password" helperText="Ít nhất 8 ký tự, có chữ hoa, chữ thường và số." {...password.register("newPassword", { required: true })} />
              <Input label="Xác nhận mật khẩu mới" type="password" {...password.register("confirmPassword", { required: true })} />
              <Button type="submit" loading={password.formState.isSubmitting}>Đổi mật khẩu</Button>
            </form>
          </div>
          <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-6 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
            <h3 className="tw-mb-3 tw-mt-0 tw-text-lg tw-font-black">Giao diện</h3>
            <button type="button" onClick={toggleMode} className="tw-flex tw-w-full tw-items-center tw-justify-between tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-transparent tw-p-4 tw-text-left dark:tw-border-slate-700">
              <div><strong className="tw-block">Chế độ {mode === "light" ? "sáng" : "tối"}</strong><span className="tw-text-xs tw-text-slate-400">Lựa chọn được lưu trên thiết bị này.</span></div>
              {mode === "light" ? <Sun className="tw-text-amber-500" /> : <Moon className="tw-text-lavender-300" />}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
