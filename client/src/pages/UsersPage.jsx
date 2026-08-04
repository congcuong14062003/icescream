import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Lock, Pencil, Plus, Search, Unlock } from "lucide-react";
import { InputAdornment } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage } from "../services/api";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import StatusBadge from "../components/common/StatusBadge";
import { formatDate } from "../utils/format";
import { useAuth } from "../store/AuthContext";

const emptyForm = { username: "", email: "", fullName: "", phone: "", password: "IceCream@123", roleId: "", branchId: "" };

export default function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [roleEditing, setRoleEditing] = useState(null);
  const [editForm, setEditForm] = useState({ username: "", email: "", fullName: "", phone: "" });
  const [newRoleId, setNewRoleId] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const metaQuery = useQuery({
    queryKey: ["user-meta"],
    queryFn: () => api.get("/users/meta").then((response) => response.data.data),
  });
  const usersQuery = useQuery({
    queryKey: ["users", search],
    queryFn: () => api.get("/users", { params: { search, size: 100 } }).then((response) => response.data.data),
  });
  const createMutation = useMutation({
    mutationFn: () => api.post("/users", { ...form, branchId: form.branchId || null }),
    onSuccess: () => {
      toast.success("Đã tạo tài khoản nhân viên");
      setCreateOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/users/${id}`, data),
    onSuccess: () => {
      toast.success("Đã cập nhật nhân viên");
      setRoleEditing(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const passwordMutation = useMutation({
    mutationFn: ({ id, password }) => api.patch(`/users/${id}/password`, { newPassword: password }),
    onSuccess: () => {
      toast.success("Đã đặt lại mật khẩu nhân viên và đăng xuất các phiên cũ");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const openEmployeeEditor = (employee) => {
    setRoleEditing(employee);
    setEditForm({
      username: employee.username || "",
      email: employee.email || "",
      fullName: employee.fullName || "",
      phone: employee.phone || "",
    });
    setNewRoleId(employee.role.id);
    setNewBranchId(employee.branch?.id || "");
    setNewPassword("");
    setConfirmPassword("");
  };
  const columns = [
    { key: "fullName", label: "Nhân viên", render: (value, row) => <div className="tw-flex tw-items-center tw-gap-3"><div className="tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-full tw-bg-mint-100 tw-font-black tw-text-mint-700">{value.charAt(0)}</div><div><strong>{value}</strong><div className="tw-text-xs tw-text-slate-400">@{row.username}</div></div></div> },
    { key: "role", label: "Vai trò", render: (value, row) => <button type="button" onClick={() => openEmployeeEditor(row)} className="tw-rounded-full tw-border-0 tw-bg-lavender-50 tw-px-3 tw-py-1.5 tw-text-xs tw-font-bold tw-text-lavender-500 dark:tw-bg-lavender-500/10">{value.name}</button> },
    {
      key: "branch",
      label: "Chi nhánh",
      render: (value, row) => metaQuery.data?.canUpdateBranch ? (
        <button
          type="button"
          onClick={() => openEmployeeEditor(row)}
          className="tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-left tw-text-xs tw-font-semibold tw-text-slate-700 hover:tw-border-mint-400 hover:tw-text-mint-700 dark:tw-border-slate-700 dark:tw-bg-slate-900 dark:tw-text-slate-200"
        >
          {value?.name || "Toàn hệ thống"}
        </button>
      ) : value?.name || "Chưa gán chi nhánh",
    },
    { key: "lastLoginAt", label: "Đăng nhập gần nhất", render: (value) => formatDate(value, true) },
    { key: "status", label: "Trạng thái", render: (value) => <StatusBadge status={value} label={{ ACTIVE: "Đang hoạt động", LOCKED: "Đã khóa", INACTIVE: "Ngừng hoạt động" }[value]} /> },
    { key: "action", label: "", align: "right", render: (_, row) => <div className="tw-flex tw-justify-end tw-gap-2"><Button variant="outlined" size="small" startIcon={<Pencil size={15} />} onClick={() => openEmployeeEditor(row)}>Sửa</Button><Button variant="outlined" size="small" color={row.status === "ACTIVE" ? "error" : "primary"} startIcon={row.status === "ACTIVE" ? <Lock size={15} /> : <Unlock size={15} />} onClick={() => updateMutation.mutate({ id: row.id, data: { status: row.status === "ACTIVE" ? "LOCKED" : "ACTIVE" } })}>{row.status === "ACTIVE" ? "Khóa" : "Mở khóa"}</Button></div> },
  ];
  const changeForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Tài khoản & phân quyền"
        title="Nhân viên"
        description={user.role.code === "ADMIN"
          ? "Admin xem toàn bộ nhân viên và có thể cập nhật vai trò, chi nhánh."
          : "Danh sách chỉ gồm nhân viên thuộc chi nhánh bạn quản lý; không thể cấp quyền Admin."}
        actions={<Button startIcon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>Thêm nhân viên</Button>}
      />
      <div className="tw-max-w-xl tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <Input placeholder="Tìm tên, username hoặc email..." value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> }} />
      </div>
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <DataTable columns={columns} rows={usersQuery.data || []} loading={usersQuery.isLoading} />
      </div>
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo tài khoản nhân viên"
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button loading={createMutation.isPending} disabled={!form.username || !form.email || !form.fullName || !form.roleId} onClick={() => createMutation.mutate()}>Tạo tài khoản</Button>
          </>
        }
      >
        <div className="tw-grid tw-gap-4 tw-pt-2 sm:tw-grid-cols-2">
          <Input label="Tên đăng nhập" value={form.username} onChange={(event) => changeForm("username", event.target.value.toLowerCase())} />
          <Input label="Email" type="email" value={form.email} onChange={(event) => changeForm("email", event.target.value)} />
          <Input label="Họ và tên" value={form.fullName} onChange={(event) => changeForm("fullName", event.target.value)} />
          <Input label="Số điện thoại" value={form.phone} onChange={(event) => changeForm("phone", event.target.value)} />
          <Input label="Mật khẩu ban đầu" type="password" value={form.password} onChange={(event) => changeForm("password", event.target.value)} />
          <Select label="Vai trò" value={form.roleId} onChange={(event) => changeForm("roleId", event.target.value)} options={(metaQuery.data?.roles || []).map((item) => ({ value: item.id, label: item.name }))} />
          <div className="sm:tw-col-span-2">
            <Select label="Chi nhánh" value={form.branchId} onChange={(event) => changeForm("branchId", event.target.value)} options={[{ value: "", label: "Chưa gán chi nhánh" }, ...(metaQuery.data?.branches || []).map((item) => ({ value: item.id, label: item.name }))]} />
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(roleEditing)}
        onClose={() => setRoleEditing(null)}
        title={`Cập nhật nhân viên ${roleEditing?.fullName || ""}`}
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setRoleEditing(null)}>Hủy</Button>
            <Button
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate({
                id: roleEditing.id,
                data: {
                  username: editForm.username,
                  email: editForm.email,
                  fullName: editForm.fullName,
                  phone: editForm.phone || null,
                  roleId: newRoleId,
                  ...(metaQuery.data?.canUpdateBranch ? { branchId: newBranchId || null } : {}),
                },
              })}
            >
              Lưu thay đổi
            </Button>
          </>
        }
      >
        <div className="tw-space-y-5">
          <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
            <Input label="Tên đăng nhập" value={editForm.username} onChange={(event) => setEditForm((current) => ({ ...current, username: event.target.value.toLowerCase() }))} />
            <Input label="Email" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} />
            <Input label="Họ và tên" value={editForm.fullName} onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))} />
            <Input label="Số điện thoại" value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} />
          </div>
          <Select label="Vai trò" value={newRoleId} onChange={(event) => setNewRoleId(event.target.value)} options={(metaQuery.data?.roles || []).map((item) => ({ value: item.id, label: `${item.name} (${item.code})` }))} />
          <Select
            label="Chi nhánh"
            value={newBranchId}
            onChange={(event) => setNewBranchId(event.target.value)}
            disabled={!metaQuery.data?.canUpdateBranch}
            options={[
              { value: "", label: "Chưa gán chi nhánh / toàn hệ thống" },
              ...(metaQuery.data?.branches || []).map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          {!metaQuery.data?.canUpdateBranch && (
            <p className="tw-m-0 tw-text-xs tw-text-slate-400">
              Chỉ Admin được chuyển nhân viên sang chi nhánh khác.
            </p>
          )}
          <div className="tw-border-t tw-border-slate-200 tw-pt-5 dark:tw-border-slate-700">
            <div className="tw-mb-3 tw-flex tw-items-center tw-gap-2">
              <KeyRound size={18} className="tw-text-mint-600" />
              <strong>Đặt lại mật khẩu</strong>
            </div>
            <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
              <Input label="Mật khẩu mới" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
              <Input label="Xác nhận mật khẩu" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
            </div>
            <p className="tw-mb-3 tw-mt-2 tw-text-xs tw-text-slate-400">Tối thiểu 8 ký tự, có chữ hoa, chữ thường và chữ số. Nhân viên sẽ bị đăng xuất khỏi các phiên đang mở.</p>
            <Button
              variant="outlined"
              startIcon={<KeyRound size={16} />}
              loading={passwordMutation.isPending}
              disabled={!newPassword || !confirmPassword}
              onClick={() => {
                if (newPassword !== confirmPassword) return toast.error("Mật khẩu xác nhận không khớp");
                if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) return toast.error("Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số");
                passwordMutation.mutate({ id: roleEditing.id, password: newPassword });
              }}
            >
              Cập nhật mật khẩu
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
