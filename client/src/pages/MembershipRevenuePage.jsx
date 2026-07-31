import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeDollarSign,
  Crown,
  ReceiptText,
  UsersRound,
} from "lucide-react";
import api, { apiMessage } from "../services/api";
import DataTable from "../components/common/DataTable";
import EmptyState from "../components/common/EmptyState";
import Input from "../components/common/Input";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import {
  daysAgoInput,
  formatDate,
  formatMoney,
  paymentMethodLabels,
  todayInput,
} from "../utils/format";
import { useAuth } from "../store/AuthContext";

const chartColors = ["#16816e", "#8067d4", "#e49a35", "#3b82f6"];

function changeText(value, metric) {
  if (value == null) return `Chưa có ${metric} ở kỳ trước`;
  return `${value >= 0 ? "Tăng" : "Giảm"} ${Math.abs(value).toLocaleString("vi-VN")}% so với kỳ trước`;
}

function StatCard({ label, value, helper, icon: Icon, color = "mint" }) {
  const colors = {
    mint: "tw-bg-mint-50 tw-text-mint-700 dark:tw-bg-mint-500/15 dark:tw-text-mint-300",
    violet: "tw-bg-violet-50 tw-text-violet-600 dark:tw-bg-violet-500/15 dark:tw-text-violet-300",
    amber: "tw-bg-amber-50 tw-text-amber-700 dark:tw-bg-amber-500/15 dark:tw-text-amber-300",
    blue: "tw-bg-blue-50 tw-text-blue-600 dark:tw-bg-blue-500/15 dark:tw-text-blue-300",
  }[color];
  return (
    <div className="tw-relative tw-overflow-hidden tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-5 tw-shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
      <span className="tw-absolute tw-inset-x-0 tw-top-0 tw-h-[3px] tw-bg-gradient-to-r tw-from-mint-500 tw-to-transparent" />
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
        <div className="tw-min-w-0">
          <div className="tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-[0.07em] tw-text-slate-400">{label}</div>
          <div className="tw-mt-2.5 tw-truncate tw-text-2xl tw-font-extrabold tw-tracking-[-0.035em] tw-text-slate-950 dark:tw-text-white">{value}</div>
        </div>
        <div className={`tw-rounded-xl tw-p-2.5 ${colors}`}><Icon size={20} /></div>
      </div>
      <div className="tw-mt-4 tw-border-t tw-border-slate-100 tw-pt-3 tw-text-[11px] tw-font-medium tw-text-slate-500 dark:tw-border-slate-800 dark:tw-text-slate-400">{helper}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <section className={`tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-5 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900 ${className}`}>
      <div className="tw-mb-5 tw-flex tw-items-start tw-justify-between tw-gap-3">
        <div>
          <h3 className="tw-m-0 tw-text-base tw-font-extrabold tw-tracking-[-0.02em]">{title}</h3>
          <p className="tw-mb-0 tw-mt-1 tw-text-[11px] tw-text-slate-400">{subtitle}</p>
        </div>
        <span className="tw-mt-1 tw-h-2 tw-w-2 tw-shrink-0 tw-rounded-full tw-bg-mint-500" />
      </div>
      {children}
    </section>
  );
}

export default function MembershipRevenuePage() {
  const { user } = useAuth();
  const canSelectBranch = ["ADMIN", "MANAGER"].includes(user.role.code);
  const isAdmin = user.role.code === "ADMIN";
  const [filters, setFilters] = useState({
    from: daysAgoInput(29),
    to: todayInput(),
    branchId: canSelectBranch ? "" : user.branch?.id || "",
  });

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches").then((response) => response.data.data),
  });
  const reportQuery = useQuery({
    queryKey: ["membership-revenue", filters],
    queryFn: () => api.get("/reports/membership-revenue", {
      params: {
        from: filters.from,
        to: filters.to,
        branchId: filters.branchId || undefined,
      },
    }).then((response) => response.data.data),
    enabled: Boolean(filters.from && filters.to && filters.from <= filters.to),
  });
  const report = reportQuery.data;

  const recentColumns = [
    {
      key: "createdAt",
      label: "Thời gian thu",
      render: (value, row) => (
        <div><strong>{formatDate(value, true)}</strong><div className="tw-text-xs tw-text-slate-400">{row.code}</div></div>
      ),
    },
    {
      key: "customer",
      label: "Khách hàng",
      render: (value) => <div><strong className="tw-block tw-text-sm">{value.fullName}</strong><span className="tw-text-xs tw-text-slate-400">{value.phone}</span></div>,
    },
    { key: "membershipPlan", label: "Gói hội viên", render: (value) => <div><strong className="tw-block tw-text-sm">{value.name}</strong><span className="tw-text-xs tw-text-slate-400">{value.code}</span></div> },
    { key: "branch", label: "Chi nhánh", render: (value) => value.name },
    { key: "createdBy", label: "Nhân viên thu", render: (value) => value.fullName },
    { key: "paymentMethod", label: "Thanh toán", render: (value) => paymentMethodLabels[value] || value },
    { key: "amountPaid", label: "Đã thu", align: "right", render: (value) => <strong className="tw-text-mint-700 dark:tw-text-mint-300">{formatMoney(value)}</strong> },
  ];

  const employeeColumns = [
    { key: "name", label: "Nhân viên" },
    { key: "branchName", label: "Chi nhánh" },
    { key: "subscriptions", label: "Lượt thu", align: "right", render: (value) => value.toLocaleString("vi-VN") },
    { key: "revenue", label: "Doanh thu", align: "right", render: (value) => <strong>{formatMoney(value)}</strong> },
  ];

  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-8">
      <PageHeader
        eyebrow="Paid membership analytics"
        title="Doanh thu gói hội viên"
        description="Theo dõi phí đăng ký và gia hạn đã thu theo ngày, gói, chi nhánh và nhân viên."
      />

      <div className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-grid-cols-3 sm:tw-items-end dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <Input
          label="Từ ngày"
          type="date"
          value={filters.from}
          inputProps={{ max: filters.to }}
          InputLabelProps={{ shrink: true }}
          onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
        />
        <Input
          label="Đến ngày"
          type="date"
          value={filters.to}
          inputProps={{ min: filters.from, max: todayInput() }}
          InputLabelProps={{ shrink: true }}
          onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
        />
        <Select
          label="Chi nhánh"
          value={filters.branchId}
          onChange={(event) => setFilters((current) => ({ ...current, branchId: event.target.value }))}
          options={[
            ...(canSelectBranch ? [{ value: "", label: isAdmin ? "Tất cả chi nhánh" : "Tất cả chi nhánh được quản lý" }] : []),
            ...(branchesQuery.data || []).map((branch) => ({ value: branch.id, label: branch.name })),
            ...(!canSelectBranch && !user.branch?.id ? [{ value: "", label: "Chưa được phân chi nhánh" }] : []),
          ]}
          disabled={!canSelectBranch}
        />
      </div>

      {reportQuery.isLoading ? (
        <LoadingSkeleton rows={8} cards />
      ) : reportQuery.isError ? (
        <EmptyState
          title="Không tải được doanh thu hội viên"
          description={apiMessage(reportQuery.error)}
        />
      ) : report ? (
        <>
          <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2 xl:tw-grid-cols-4">
            <StatCard
              label="Doanh thu phí hội viên"
              value={formatMoney(report.summary.revenue)}
              helper={changeText(report.summary.revenueChange, "doanh thu")}
              icon={BadgeDollarSign}
            />
            <StatCard
              label="Lượt đăng ký & gia hạn"
              value={report.summary.subscriptions.toLocaleString("vi-VN")}
              helper={`${report.summary.newSubscriptions} đăng ký mới · ${report.summary.renewals} gia hạn`}
              icon={ReceiptText}
              color="violet"
            />
            <StatCard
              label="Khách đã đóng phí"
              value={report.summary.uniqueCustomers.toLocaleString("vi-VN")}
              helper={`${report.summary.activeSubscriptions.toLocaleString("vi-VN")} gói đang còn hiệu lực trong phạm vi`}
              icon={UsersRound}
              color="blue"
            />
            <StatCard
              label="Phí trung bình"
              value={formatMoney(report.summary.averageRevenue)}
              helper={changeText(report.summary.subscriptionChange, "lượt đăng ký")}
              icon={Crown}
              color="amber"
            />
          </div>

          <div className="tw-grid tw-gap-5 xl:tw-grid-cols-[1.45fr_1fr]">
            <ChartCard title="Doanh thu theo ngày" subtitle="Phí hội viên thực thu và số lượt phát sinh">
              {report.dailySeries.length ? (
                <div className="tw-h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={report.dailySeries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe5e2" />
                      <XAxis dataKey="date" tickFormatter={(value) => value.slice(5).split("-").reverse().join("/")} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="money" tickFormatter={(value) => `${Math.round(value / 1000000)}tr`} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value, name) => [name === "revenue" ? formatMoney(value) : value.toLocaleString("vi-VN"), name === "revenue" ? "Doanh thu" : "Lượt đăng ký"]}
                        labelFormatter={(value) => formatDate(value)}
                      />
                      <Legend formatter={(value) => value === "revenue" ? "Doanh thu" : "Lượt đăng ký"} />
                      <Bar yAxisId="count" dataKey="subscriptions" fill="#c7b8f4" radius={[5, 5, 0, 0]} maxBarSize={28} />
                      <Line yAxisId="money" type="monotone" dataKey="revenue" stroke="#16816e" strokeWidth={2.6} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState title="Chưa phát sinh phí hội viên trong kỳ" />}
            </ChartCard>

            <ChartCard title="Doanh thu theo gói" subtitle="Xếp hạng theo phí đăng ký và gia hạn đã thu">
              {report.planBreakdown.length ? (
                <div className="tw-h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.planBreakdown} layout="vertical" margin={{ left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(value) => `${Math.round(value / 1000000)}tr`} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [formatMoney(value), "Doanh thu"]} />
                      <Bar dataKey="revenue" fill="#8067d4" radius={[0, 6, 6, 0]} maxBarSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState title="Chưa có dữ liệu theo gói" />}
            </ChartCard>
          </div>

          <div className="tw-grid tw-gap-5 xl:tw-grid-cols-[0.9fr_1.1fr]">
            <ChartCard title="Phương thức thanh toán" subtitle="Cơ cấu khoản phí hội viên đã thu">
              {report.paymentBreakdown.length ? (
                <div className="tw-h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={report.paymentBreakdown} dataKey="revenue" nameKey="method" innerRadius={58} outerRadius={92} paddingAngle={4}>
                        {report.paymentBreakdown.map((item, index) => <Cell key={item.method} fill={chartColors[index % chartColors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value, name) => [formatMoney(value), paymentMethodLabels[name] || name]} />
                      <Legend formatter={(value) => paymentMethodLabels[value] || value} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState title="Chưa có dữ liệu thanh toán" />}
            </ChartCard>

            <ChartCard title="Doanh thu theo chi nhánh" subtitle="Chỉ hiển thị các chi nhánh tài khoản được phép xem">
              {report.branchBreakdown.length ? (
                <div className="tw-space-y-3">
                  {report.branchBreakdown.map((branch, index) => {
                    const maxRevenue = Math.max(1, ...report.branchBreakdown.map((item) => item.revenue));
                    return (
                      <div key={branch.id} className="tw-rounded-2xl tw-border tw-border-slate-100 tw-p-4 dark:tw-border-slate-800">
                        <div className="tw-flex tw-items-start tw-gap-3">
                          <span className="tw-flex tw-h-8 tw-w-8 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-bg-mint-50 tw-text-xs tw-font-black tw-text-mint-700 dark:tw-bg-mint-500/10">{index + 1}</span>
                          <div className="tw-min-w-0 tw-flex-1">
                            <div className="tw-flex tw-items-center tw-justify-between tw-gap-3"><strong className="tw-truncate tw-text-sm">{branch.name}</strong><strong className="tw-text-sm tw-text-mint-700 dark:tw-text-mint-300">{formatMoney(branch.revenue)}</strong></div>
                            <div className="tw-mt-1 tw-text-[11px] tw-text-slate-400">{branch.subscriptions.toLocaleString("vi-VN")} lượt thu</div>
                            <div className="tw-mt-2 tw-h-1.5 tw-overflow-hidden tw-rounded-full tw-bg-slate-100 dark:tw-bg-slate-800"><div className="tw-h-full tw-rounded-full tw-bg-gradient-to-r tw-from-mint-500 tw-to-violet-500" style={{ width: `${Math.max(3, (branch.revenue / maxRevenue) * 100)}%` }} /></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState title="Chưa có dữ liệu chi nhánh" />}
            </ChartCard>
          </div>

          <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-5 dark:tw-border-slate-700 dark:tw-bg-slate-900">
            <div className="tw-mb-4">
              <h3 className="tw-m-0 tw-text-base tw-font-extrabold">Doanh thu theo nhân viên</h3>
              <p className="tw-mb-0 tw-mt-1 tw-text-xs tw-text-slate-400">Nhân viên chỉ xuất hiện trong phạm vi chi nhánh được backend cho phép.</p>
            </div>
            <DataTable
              columns={employeeColumns}
              rows={report.employeeBreakdown}
              getRowKey={(row) => `${row.id}-${row.branchId}`}
            />
          </section>

          <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-5 dark:tw-border-slate-700 dark:tw-bg-slate-900">
            <div className="tw-mb-4">
              <h3 className="tw-m-0 tw-text-base tw-font-extrabold">Lịch sử thu phí gần nhất</h3>
              <p className="tw-mb-0 tw-mt-1 tw-text-xs tw-text-slate-400">Tối đa 20 giao dịch mới nhất trong khoảng thời gian đã chọn.</p>
            </div>
            <DataTable columns={recentColumns} rows={report.recentSubscriptions} />
          </section>
        </>
      ) : (
        <EmptyState title="Chưa có dữ liệu báo cáo" />
      )}
    </div>
  );
}
