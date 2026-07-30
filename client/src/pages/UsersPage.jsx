import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Search, Unlock } from "lucide-react";
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

const emptyForm = { username: "", email: "", fullName: "", phone: "", password: "IceCream@123", roleId: "", branchId: "" };

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [roleEditing, setRoleEditing] = useState(null);
  const [newRoleId, setNewRoleId] = useState("");
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
  const columns = [
    { key: "fullName", label: "Nhân viên", render: (value, row) => <div className="tw-flex tw-items-center tw-gap-3"><div className="tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-full tw-bg-mint-100 tw-font-black tw-text-mint-700">{value.charAt(0)}</div><div><strong>{value}</strong><div className="tw-text-xs tw-text-slate-400">@{row.username}</div></div></div> },
    { key: "role", label: "Vai trò", render: (value, row) => <button type="button" onClick={() => { setRoleEditing(row); setNewRoleId(value.id); }} className="tw-rounded-full tw-border-0 tw-bg-lavender-50 tw-px-3 tw-py-1.5 tw-text-xs tw-font-bold tw-text-lavender-500 dark:tw-bg-lavender-500/10">{value.name}</button> },
    { key: "branch", label: "Chi nhánh", render: (value) => value?.name || "Toàn hệ thống" },
    { key: "lastLoginAt", label: "Đăng nhập gần nhất", render: (value) => formatDate(value, true) },
    { key: "status", label: "Trạng thái", render: (value) => <StatusBadge status={value} label={{ ACTIVE: "Đang hoạt động", LOCKED: "Đã khóa", INACTIVE: "Ngừng hoạt động" }[value]} /> },
    { key: "action", label: "", align: "right", render: (_, row) => <Button variant="outlined" size="small" color={row.status === "ACTIVE" ? "error" : "primary"} startIcon={row.status === "ACTIVE" ? <Lock size={15} /> : <Unlock size={15} />} onClick={() => updateMutation.mutate({ id: row.id, data: { status: row.status === "ACTIVE" ? "LOCKED" : "ACTIVE" } })}>{row.status === "ACTIVE" ? "Khóa" : "Mở khóa"}</Button> },
  ];
  const changeForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Tài khoản & phân quyền"
        title="Nhân viên"
        description="Khóa tài khoản sẽ thu hồi refresh token; mọi API vẫn kiểm tra quyền phía backend."
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
        title={`Phân quyền cho ${roleEditing?.fullName || ""}`}
        actions={
          <>
            <Button variant="text" color="inherit" onClick={() => setRoleEditing(null)}>Hủy</Button>
            <Button loading={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: roleEditing.id, data: { roleId: newRoleId } })}>Cập nhật vai trò</Button>
          </>
        }
      >
        <Select label="Vai trò" value={newRoleId} onChange={(event) => setNewRoleId(event.target.value)} options={(metaQuery.data?.roles || []).map((item) => ({ value: item.id, label: `${item.name} (${item.code})` }))} />
      </Modal>
    </div>
  );
}
