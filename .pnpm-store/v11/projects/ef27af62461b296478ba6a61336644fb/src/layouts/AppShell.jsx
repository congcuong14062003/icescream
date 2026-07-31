import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BadgePercent,
  Boxes,
  Gauge,
  IceCreamBowl,
  LogOut,
  Menu,
  Moon,
  PackageOpen,
  ReceiptText,
  Settings,
  ShoppingBag,
  Sun,
  Users,
  UsersRound,
  WalletCards,
  Crown,
  ChartNoAxesCombined,
  Award,
  X,
} from "lucide-react";
import { Avatar, IconButton, Tooltip } from "@mui/material";
import BrandLogo from "../components/common/BrandLogo";
import { useAuth } from "../store/AuthContext";
import { useColorMode } from "../store/ColorModeContext";

const navigation = [
  { to: "/", label: "Tổng quan", icon: Gauge, permissions: ["dashboard.view"] },
  { to: "/pos", label: "Bán hàng POS", icon: ShoppingBag, permissions: ["pos.use"], primary: true },
  { to: "/orders", label: "Đơn hàng", icon: ReceiptText, permissions: ["orders.view"] },
  { to: "/products", label: "Sản phẩm", icon: IceCreamBowl, permissions: ["products.view"] },
  { to: "/promotions", label: "Ưu đãi", icon: BadgePercent, permissions: ["promotions.manage"] },
  { to: "/memberships", label: "Gói hội viên", icon: Crown, permissions: ["promotions.manage"] },
  { to: "/membership-revenue", label: "Doanh thu hội viên", icon: ChartNoAxesCombined, permissions: ["memberships.revenue.view"] },
  { to: "/loyalty", label: "Hạng & voucher", icon: Award, permissions: ["promotions.manage"] },
  { to: "/customers", label: "Khách hàng", icon: UsersRound, permissions: ["customers.view"] },
  { to: "/inventory", label: "Kho nguyên liệu", icon: Boxes, permissions: ["inventory.view"] },
  { to: "/purchase-orders", label: "Phiếu nhập kho", icon: PackageOpen, permissions: ["inventory.manage"] },
  { to: "/shifts", label: "Ca làm việc", icon: WalletCards, permissions: ["shifts.manage"] },
  { to: "/users", label: "Nhân viên", icon: Users, permissions: ["users.manage"] },
  { to: "/settings", label: "Tài khoản", icon: Settings, permissions: [] },
];

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasPermission } = useAuth();
  const { mode, toggleMode } = useColorMode();
  const navigate = useNavigate();
  const location = useLocation();
  const current = navigation.find((item) => item.to === location.pathname);
  const allowed = navigation.filter(
    (item) => !item.permissions.length || hasPermission(...item.permissions),
  );
  const currentDate = useMemo(
    () => new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date()),
    [],
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const sidebar = (
    <aside
      className={`tw-flex tw-h-full tw-flex-col tw-border-r tw-border-white/[0.06] tw-bg-[#0b2924] tw-p-3 tw-text-white tw-shadow-[8px_0_32px_rgba(5,33,29,0.08)] tw-transition-all tw-duration-200 dark:tw-bg-[#071e1a] ${
        collapsed ? "tw-w-[76px]" : "tw-w-[248px]"
      }`}
    >
      <div className="tw-flex tw-h-16 tw-items-center tw-justify-between tw-px-2">
        <BrandLogo compact={collapsed} light />
        {!collapsed && (
          <IconButton
            size="small"
            onClick={() => setCollapsed(true)}
            className="!tw-hidden !tw-bg-white/5 !tw-text-white/70 hover:!tw-bg-white/10 lg:!tw-inline-flex"
            aria-label="Thu gọn menu"
          >
            <Menu size={17} />
          </IconButton>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="tw-mx-auto tw-mb-2 tw-hidden tw-rounded-lg tw-border-0 tw-bg-white/5 tw-p-2 tw-text-white/70 hover:tw-bg-white/10 lg:tw-block"
          aria-label="Mở rộng menu"
        >
          <Menu size={18} />
        </button>
      )}

      {!collapsed && (
        <div className="tw-mb-2 tw-mt-3 tw-px-3 tw-text-[10px] tw-font-bold tw-uppercase tw-tracking-[0.16em] tw-text-white/35">
          Vận hành cửa hàng
        </div>
      )}
      <nav className="no-scrollbar tw-flex-1 tw-space-y-1 tw-overflow-y-auto tw-py-2">
        {allowed.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.to);
          const link = (
            <NavLink
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileOpen(false)}
              aria-label={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={`tw-group tw-relative tw-flex tw-min-h-[48px] tw-w-full tw-items-center tw-gap-3 tw-rounded-xl tw-px-2 tw-text-[13px] tw-font-semibold tw-no-underline tw-transition-all tw-duration-200 ${
                isActive
                  ? "tw-bg-white tw-text-[#0b3d35] tw-shadow-[0_8px_22px_rgba(0,0,0,0.14)]"
                  : item.primary
                    ? "tw-bg-mint-500/15 tw-text-mint-100 hover:tw-bg-mint-500/25"
                    : "tw-text-white/65 hover:tw-translate-x-0.5 hover:tw-bg-white/[0.07] hover:tw-text-white"
              } ${collapsed ? "tw-justify-center" : ""}`}
            >
              <span
                className={`tw-flex tw-h-8 tw-w-8 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-transition-colors ${
                  isActive
                    ? "tw-bg-mint-50 tw-text-mint-700"
                    : "tw-bg-white/[0.055] tw-text-inherit group-hover:tw-bg-white/10"
                }`}
              >
                <Icon size={18} strokeWidth={2.1} />
              </span>
              {!collapsed && <span className="tw-min-w-0 tw-flex-1 tw-truncate">{item.label}</span>}
              {item.primary && !collapsed && (
                <span className={`tw-rounded-md tw-px-1.5 tw-py-0.5 tw-text-[9px] tw-font-extrabold tw-uppercase tw-tracking-wider ${
                  isActive
                    ? "tw-bg-mint-100 tw-text-mint-700"
                    : "tw-bg-mint-400/20 tw-text-mint-100"
                }`}>
                  Quick
                </span>
              )}
            </NavLink>
          );

          return collapsed ? (
            <Tooltip key={item.to} title={item.label} placement="right" arrow>
              <span className="tw-block">{link}</span>
            </Tooltip>
          ) : (
            <div key={item.to}>{link}</div>
          );
        })}
      </nav>

      <div className="tw-mt-3 tw-border-t tw-border-white/10 tw-pt-3">
        {collapsed ? (
          <Tooltip title={mode === "light" ? "Bật chế độ tối" : "Bật chế độ sáng"} placement="right" arrow>
            <button
              type="button"
              onClick={toggleMode}
              className="tw-mb-2 tw-flex tw-h-11 tw-w-full tw-items-center tw-justify-center tw-rounded-xl tw-border-0 tw-bg-white/[0.055] tw-text-white/70 tw-transition-colors hover:tw-bg-white/10 hover:tw-text-white"
              aria-label={mode === "light" ? "Bật chế độ tối" : "Bật chế độ sáng"}
            >
              {mode === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={toggleMode}
            className="tw-mb-2 tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-xl tw-border-0 tw-bg-white/[0.055] tw-p-2 tw-text-left tw-text-white/70 tw-transition-colors hover:tw-bg-white/10 hover:tw-text-white"
          >
            <span className="tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-bg-white/[0.07]">
              {mode === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </span>
            <span className="tw-flex-1 tw-text-xs tw-font-semibold">
              {mode === "light" ? "Chế độ tối" : "Chế độ sáng"}
            </span>
            <span
              className={`tw-relative tw-h-5 tw-w-9 tw-rounded-full tw-transition-colors ${
                mode === "dark" ? "tw-bg-mint-400" : "tw-bg-white/20"
              }`}
              aria-hidden="true"
            >
              <span
                className={`tw-absolute tw-top-0.5 tw-h-4 tw-w-4 tw-rounded-full tw-bg-white tw-shadow-sm tw-transition-transform ${
                  mode === "dark" ? "tw-translate-x-[18px]" : "tw-translate-x-0.5"
                }`}
              />
            </span>
          </button>
        )}
        {!collapsed && (
          <div className="tw-mb-2 tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-bg-white/[0.055] tw-p-3">
            <Avatar
              src={user.avatarUrl || undefined}
              sx={{ width: 36, height: 36, bgcolor: "#d5f5ea", color: "#14675a", fontWeight: 800, fontSize: 14 }}
            >
              {user.fullName?.charAt(0)}
            </Avatar>
            <div className="tw-min-w-0 tw-flex-1">
              <div className="tw-truncate tw-text-xs tw-font-bold tw-text-white">{user.fullName}</div>
              <div className="tw-mt-0.5 tw-truncate tw-text-[10px] tw-text-white/45">{user.role?.name}</div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-xl tw-border-0 tw-bg-transparent tw-px-3 tw-py-2.5 tw-text-xs tw-font-semibold tw-text-white/45 hover:tw-bg-rose-500/10 hover:tw-text-rose-200"
        >
          <LogOut size={18} />
          {!collapsed && "Đăng xuất"}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="tw-flex tw-h-screen tw-overflow-hidden tw-bg-[#f3f6f5] dark:tw-bg-[#0b1211]">
      <div className="tw-hidden lg:tw-block">{sidebar}</div>
      {mobileOpen && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-flex lg:tw-hidden">
          <button
            type="button"
            className="tw-absolute tw-inset-0 tw-border-0 tw-bg-slate-950/55 tw-backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
          />
          <div className="tw-relative tw-h-full tw-shadow-2xl">
            {sidebar}
            <button
              type="button"
              className="tw-absolute tw-right-3 tw-top-3 tw-rounded-lg tw-border-0 tw-bg-white/10 tw-p-2 tw-text-white"
              onClick={() => setMobileOpen(false)}
              aria-label="Đóng menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col">
        <header className="no-print tw-flex tw-h-[72px] tw-shrink-0 tw-items-center tw-justify-between tw-border-b tw-border-slate-200/80 tw-bg-white/90 tw-px-4 tw-backdrop-blur-xl sm:tw-px-6 dark:tw-border-slate-800 dark:tw-bg-[#111b19]/90">
          <div className="tw-flex tw-min-w-0 tw-items-center tw-gap-3">
            <IconButton onClick={() => setMobileOpen(true)} className="lg:!tw-hidden" aria-label="Mở menu">
              <Menu />
            </IconButton>
            <div className="tw-min-w-0">
              <div className="tw-flex tw-items-center tw-gap-2">
                <h1 className="tw-m-0 tw-truncate tw-text-xl tw-font-extrabold tw-tracking-[-0.035em] tw-text-slate-950 sm:tw-text-[23px] dark:tw-text-white">
                  {current?.label || "IceCream POS"}
                </h1>
                <span className="tw-hidden tw-h-1.5 tw-w-1.5 tw-rounded-full tw-bg-emerald-500 sm:tw-block" />
              </div>
              <p className="tw-m-0 tw-mt-0.5 tw-hidden tw-text-[11px] tw-font-medium tw-capitalize tw-text-slate-400 sm:tw-block">
                {user.branch?.name || "Toàn hệ thống"} · {currentDate}
              </p>
            </div>
          </div>

          <div className="tw-flex tw-items-center tw-gap-2">
            <div className="tw-hidden tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-slate-50 tw-px-3 tw-py-2 tw-text-[11px] tw-font-bold tw-text-slate-500 md:tw-flex dark:tw-border-slate-700 dark:tw-bg-slate-800">
              <span className="tw-h-2 tw-w-2 tw-rounded-full tw-bg-emerald-500 tw-shadow-[0_0_0_4px_rgba(16,185,129,0.1)]" />
              Hệ thống hoạt động
            </div>
            <Tooltip title={mode === "light" ? "Bật chế độ tối" : "Bật chế độ sáng"}>
              <IconButton
                onClick={toggleMode}
                className="!tw-border !tw-border-slate-200 !tw-bg-white dark:!tw-border-slate-700 dark:!tw-bg-slate-800"
              >
                {mode === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </IconButton>
            </Tooltip>
            <Avatar
              src={user.avatarUrl || undefined}
              sx={{ width: 38, height: 38, bgcolor: "#d5f5ea", color: "#14675a", fontWeight: 800, fontSize: 14 }}
              className="lg:!tw-hidden"
            >
              {user.fullName?.charAt(0)}
            </Avatar>
          </div>
        </header>
        <main className="ice-gradient soft-scrollbar tw-min-h-0 tw-flex-1 tw-overflow-auto">
          <div className="page-enter tw-min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
