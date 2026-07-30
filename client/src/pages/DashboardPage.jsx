import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
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
  AlertTriangle,
  BadgeDollarSign,
  CirclePercent,
  Coins,
  Download,
  FileText,
  IceCreamBowl,
  PackageCheck,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import { toast } from "react-toastify";
import api, { apiMessage, downloadFile } from "../services/api";
import { daysAgoInput, formatDate, formatMoney, todayInput } from "../utils/format";
import Button from "../components/common/Button";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/common/PageHeader";
import Select from "../components/common/Select";
import { useAuth } from "../store/AuthContext";

const paymentLabels = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
  EWALLET: "Ví điện tử",
};
const pieColors = ["#16816e", "#8b70dd", "#e49a35", "#3b82f6"];

function StatCard({ label, value, helper, icon: Icon, color = "mint" }) {
  const colorClass = {
    mint: "tw-bg-mint-50 tw-text-mint-700 dark:tw-bg-mint-700/20 dark:tw-text-mint-300",
    blush: "tw-bg-blue-50 tw-text-blue-600 dark:tw-bg-blue-500/15 dark:tw-text-blue-300",
    lavender: "tw-bg-violet-50 tw-text-violet-600 dark:tw-bg-violet-500/15 dark:tw-text-violet-300",
    amber: "tw-bg-amber-50 tw-text-amber-700 dark:tw-bg-amber-700/15 dark:tw-text-amber-300",
  }[color];
  return (
    <div className="tw-relative tw-overflow-hidden tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-5 tw-shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:tw-border-slate-700 dark:tw-bg-slate-900">
      <span className="tw-absolute tw-inset-x-0 tw-top-0 tw-h-[3px] tw-bg-gradient-to-r tw-from-mint-500 tw-to-transparent" />
      <div className="tw-flex tw-items-start tw-justify-between">
        <div>
          <div className="tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-[0.07em] tw-text-slate-400">{label}</div>
          <div className="tw-mt-2.5 tw-text-2xl tw-font-extrabold tw-tracking-[-0.035em] tw-text-slate-950 dark:tw-text-white">{value}</div>
        </div>
        <div className={`tw-rounded-xl tw-p-2.5 ${colorClass}`}><Icon size={20} /></div>
      </div>
      {helper && <div className="tw-mt-4 tw-border-t tw-border-slate-100 tw-pt-3 tw-text-[11px] tw-font-medium tw-text-slate-500 dark:tw-border-slate-800 dark:tw-text-slate-400">{helper}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <section className={`tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-5 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] dark:tw-border-slate-700 dark:tw-bg-slate-900 ${className}`}>
      <div className="tw-mb-5 tw-flex tw-items-start tw-justify-between">
        <div>
          <h3 className="tw-m-0 tw-text-[16px] tw-font-extrabold tw-tracking-[-0.02em]">{title}</h3>
          {subtitle && <p className="tw-mb-0 tw-mt-1 tw-text-[11px] tw-text-slate-400">{subtitle}</p>}
        </div>
        <span className="tw-mt-1 tw-h-2 tw-w-2 tw-rounded-full tw-bg-mint-500" />
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    from: daysAgoInput(6),
    to: todayInput(),
    branchId: "",
  });
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches").then((response) => response.data.data),
  });
  const reportQuery = useQuery({
    queryKey: ["dashboard", filters],
    queryFn: () =>
      api
        .get("/reports/dashboard", { params: { ...filters, branchId: filters.branchId || undefined } })
        .then((response) => response.data.data),
  });
  const report = reportQuery.data;

  const exportReport = async (type) => {
    try {
      const params = new URLSearchParams({
        from: filters.from,
        to: filters.to,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
      });
      await downloadFile(`/reports/export.${type}?${params}`, `bao-cao-icecream.${type}`);
      toast.success(`Đã xuất báo cáo ${type.toUpperCase()}`);
    } catch (error) {
      toast.error(apiMessage(error, "Không thể xuất báo cáo"));
    }
  };

  return (
    <div className="tw-space-y-6 tw-p-4 sm:tw-p-6 xl:tw-p-7">
      <PageHeader
        eyebrow="Business overview"
        title={`Tổng quan vận hành, ${user.fullName.split(" ").slice(-1)[0]}`}
        description="Doanh thu, đơn hàng và tình trạng kho được tổng hợp trực tiếp từ dữ liệu cửa hàng."
        actions={
          <>
            <Button variant="outlined" startIcon={<Download size={17} />} onClick={() => exportReport("xlsx")}>Excel</Button>
            <Button variant="outlined" startIcon={<FileText size={17} />} onClick={() => exportReport("pdf")}>PDF</Button>
          </>
        }
      />
      <div className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_1px_2px_rgba(15,23,42,0.025)] sm:tw-grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,1.15fr)] sm:tw-items-end dark:tw-border-slate-700 dark:tw-bg-slate-900">
        <label className="tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wide tw-text-slate-500">
          Từ ngày
          <input
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            className="tw-mt-1.5 tw-block tw-h-10 tw-w-full tw-rounded-xl tw-border tw-border-slate-200 tw-bg-transparent tw-px-3 tw-text-sm tw-outline-none tw-transition focus:tw-border-mint-500 focus:tw-ring-2 focus:tw-ring-mint-500/10 dark:tw-border-slate-700"
          />
        </label>
        <label className="tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wide tw-text-slate-500">
          Đến ngày
          <input
            type="date"
            value={filters.to}
            min={filters.from}
            max={todayInput()}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            className="tw-mt-1.5 tw-block tw-h-10 tw-w-full tw-rounded-xl tw-border tw-border-slate-200 tw-bg-transparent tw-px-3 tw-text-sm tw-outline-none tw-transition focus:tw-border-mint-500 focus:tw-ring-2 focus:tw-ring-mint-500/10 dark:tw-border-slate-700"
          />
        </label>
        <div className="tw-min-w-0">
          <div className="tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wide tw-text-slate-500">
            Chi nhánh
          </div>
          <div className="tw-mt-1.5">
            <Select
              label=""
              name="branchId"
              value={filters.branchId}
              inputProps={{ "aria-label": "Chi nhánh" }}
              onChange={(event) => setFilters((current) => ({ ...current, branchId: event.target.value }))}
              options={[
                { value: "", label: "Tất cả chi nhánh" },
                ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
              ]}
              disabled={!["ADMIN", "MANAGER"].includes(user.role.code)}
            />
          </div>
        </div>
      </div>

      {reportQuery.isLoading ? (
        <LoadingSkeleton rows={8} cards />
      ) : reportQuery.isError ? (
        <EmptyState title="Không tải được báo cáo" description={apiMessage(reportQuery.error)} action={<Button onClick={() => reportQuery.refetch()}>Thử lại</Button>} />
      ) : (
        <>
          {report.financials && (
            <section className="tw-space-y-4">
              <div className="tw-flex tw-flex-col tw-gap-2 sm:tw-flex-row sm:tw-items-end sm:tw-justify-between">
                <div>
                  <div className="tw-flex tw-items-center tw-gap-2 tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-[0.12em] tw-text-mint-700 dark:tw-text-mint-300">
                    <BadgeDollarSign size={16} /> Tài chính dành cho quản lý
                  </div>
                  <h2 className="tw-mb-0 tw-mt-1 tw-text-xl tw-font-extrabold tw-tracking-[-0.03em]">
                    Doanh thu & lợi nhuận
                  </h2>
                </div>
                <div className="tw-text-xs tw-text-slate-400">
                  {report.financials.actualCostCoverage}% đơn dùng giá vốn thực tế theo lô · đơn cũ dùng giá vốn sản phẩm
                </div>
              </div>
              <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2 xl:tw-grid-cols-4">
                <StatCard
                  label="Doanh thu thuần"
                  value={formatMoney(report.financials.netRevenue)}
                  helper={
                    report.financials.revenueChange === null
                      ? "Chưa có dữ liệu kỳ trước"
                      : `${report.financials.revenueChange >= 0 ? "Tăng" : "Giảm"} ${Math.abs(report.financials.revenueChange)}% so với kỳ trước`
                  }
                  icon={Wallet}
                />
                <StatCard
                  label="Giá vốn hàng bán"
                  value={formatMoney(report.financials.costOfGoods)}
                  helper={`${report.financials.actualCostOrders}/${report.summary.orders} đơn có giá vốn theo lô`}
                  icon={Coins}
                  color="amber"
                />
                <StatCard
                  label="Lợi nhuận gộp"
                  value={formatMoney(report.financials.grossProfit)}
                  helper={
                    report.financials.profitChange === null
                      ? "Chưa có dữ liệu lợi nhuận kỳ trước"
                      : `${report.financials.profitChange >= 0 ? "Tăng" : "Giảm"} ${Math.abs(report.financials.profitChange)}% so với kỳ trước`
                  }
                  icon={BadgeDollarSign}
                  color="lavender"
                />
                <StatCard
                  label="Biên lợi nhuận"
                  value={`${report.financials.grossMargin.toLocaleString("vi-VN")}%`}
                  helper={`Giảm giá ${formatMoney(report.financials.discounts)} · Hoàn ${formatMoney(report.financials.refunds)}`}
                  icon={CirclePercent}
                  color="blush"
                />
              </div>
              <div className="tw-grid tw-gap-5 xl:tw-grid-cols-[1.55fr_1fr]">
                <ChartCard title="Hiệu quả kinh doanh theo ngày" subtitle="Doanh thu chưa VAT, giá vốn và lợi nhuận gộp">
                  {report.revenueSeries.length ? (
                    <div className="tw-h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={report.revenueSeries}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe5e2" />
                          <XAxis dataKey="date" tickFormatter={(value) => value.slice(5).split("-").reverse().join("/")} tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={(value) => `${Math.round(value / 1000000)}tr`} tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(value, name) => [
                              formatMoney(value),
                              { revenue: "Doanh thu", cost: "Giá vốn", profit: "Lợi nhuận" }[name] || name,
                            ]}
                            labelFormatter={(label) => formatDate(label)}
                          />
                          <Legend formatter={(value) => ({ revenue: "Doanh thu", cost: "Giá vốn", profit: "Lợi nhuận" }[value] || value)} />
                          <Bar dataKey="revenue" fill="#16816e" radius={[5, 5, 0, 0]} maxBarSize={34} />
                          <Bar dataKey="cost" fill="#e9a23b" radius={[5, 5, 0, 0]} maxBarSize={34} />
                          <Line type="monotone" dataKey="profit" stroke="#8067d4" strokeWidth={2.5} dot={{ r: 3 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState title="Chưa có doanh thu trong kỳ" />}
                </ChartCard>
                <ChartCard title="Lợi nhuận theo chi nhánh" subtitle="So sánh doanh thu và biên lợi nhuận">
                  {report.branchProfitability.length ? (
                    <div className="tw-space-y-3">
                      {report.branchProfitability.map((branch, index) => {
                        const maxProfit = Math.max(
                          1,
                          ...report.branchProfitability.map((item) => Math.max(0, item.profit)),
                        );
                        return (
                          <div key={branch.name} className="tw-rounded-2xl tw-border tw-border-slate-100 tw-p-4 dark:tw-border-slate-800">
                            <div className="tw-flex tw-items-start tw-gap-3">
                              <span className="tw-flex tw-h-8 tw-w-8 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-bg-mint-50 tw-text-xs tw-font-black tw-text-mint-700 dark:tw-bg-mint-500/10">
                                {index + 1}
                              </span>
                              <div className="tw-min-w-0 tw-flex-1">
                                <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                                  <strong className="tw-truncate tw-text-sm">{branch.name}</strong>
                                  <strong className={branch.profit >= 0 ? "tw-text-sm tw-text-emerald-600" : "tw-text-sm tw-text-rose-500"}>
                                    {formatMoney(branch.profit)}
                                  </strong>
                                </div>
                                <div className="tw-mt-1 tw-flex tw-justify-between tw-text-[11px] tw-text-slate-400">
                                  <span>Doanh thu {formatMoney(branch.revenue)}</span>
                                  <span>Biên {branch.margin}%</span>
                                </div>
                                <div className="tw-mt-2 tw-h-1.5 tw-overflow-hidden tw-rounded-full tw-bg-slate-100 dark:tw-bg-slate-800">
                                  <div
                                    className="tw-h-full tw-rounded-full tw-bg-gradient-to-r tw-from-mint-500 tw-to-lavender-500"
                                    style={{ width: `${Math.max(3, (Math.max(0, branch.profit) / maxProfit) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <EmptyState title="Chưa có dữ liệu chi nhánh" />}
                </ChartCard>
              </div>
            </section>
          )}

          <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2 xl:tw-grid-cols-4">
            <StatCard
              label={report.financials ? "Doanh số trước ưu đãi" : "Doanh thu thuần"}
              value={formatMoney(report.financials?.salesBeforeDiscount ?? report.summary.revenue)}
              helper={
                report.financials
                  ? `Đã giảm ${formatMoney(report.financials.discounts)}`
                  : report.summary.revenueChange === null
                    ? "Chưa có dữ liệu kỳ trước"
                    : `${report.summary.revenueChange >= 0 ? "Tăng" : "Giảm"} ${Math.abs(report.summary.revenueChange)}% so với kỳ trước`
              }
              icon={report.summary.revenueChange >= 0 ? TrendingUp : TrendingDown}
            />
            <StatCard label="Đơn hoàn thành" value={report.summary.orders.toLocaleString("vi-VN")} helper={`${report.summary.completionRate}% tỷ lệ hoàn thành`} icon={ReceiptText} color="blush" />
            <StatCard label="Giá trị đơn trung bình" value={formatMoney(report.summary.averageOrderValue)} helper={`${report.summary.cancellationRate}% đơn bị hủy`} icon={Wallet} color="lavender" />
            <StatCard
              label="Khách hàng mới"
              value={report.summary.newCustomers.toLocaleString("vi-VN")}
              helper={report.financials ? `VAT đã thu ${formatMoney(report.financials.taxCollected)}` : "Khách phát sinh trong kỳ"}
              icon={UserPlus}
              color="amber"
            />
          </div>

          <div className="tw-grid tw-gap-5 xl:tw-grid-cols-[1.6fr_1fr]">
            <ChartCard title="Xu hướng doanh thu" subtitle="Doanh thu thuần theo từng ngày">
              <div className="tw-h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.revenueSeries}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16816e" stopOpacity={0.26} />
                        <stop offset="95%" stopColor="#16816e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe5e2" />
                    <XAxis dataKey="date" tickFormatter={(value) => value.slice(5).split("-").reverse().join("/")} tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => `${Math.round(value / 1000000)}tr`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value, name) => [name === "revenue" ? formatMoney(value) : value, name === "revenue" ? "Doanh thu" : "Đơn"]} labelFormatter={(label) => formatDate(label)} />
                    <Area type="monotone" dataKey="revenue" stroke="#16816e" strokeWidth={2.5} fill="url(#revenueFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title="Phương thức thanh toán" subtitle="Cơ cấu doanh thu đã thu">
              {report.paymentRevenue.length ? (
                <div className="tw-h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={report.paymentRevenue} dataKey="amount" nameKey="method" innerRadius={62} outerRadius={95} paddingAngle={4}>
                        {report.paymentRevenue.map((entry, index) => <Cell key={entry.method} fill={pieColors[index % pieColors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value, name) => [formatMoney(value), paymentLabels[name] || name]} />
                      <Legend formatter={(value) => paymentLabels[value] || value} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState />}
            </ChartCard>
          </div>

          <div className="tw-grid tw-gap-5 xl:tw-grid-cols-2">
            <ChartCard title="Sản phẩm bán chạy" subtitle="Xếp hạng theo số lượng bán">
              {report.topProducts.length ? (
                <div className="tw-h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.topProducts} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={125} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [value, "Số lượng"]} />
                      <Bar dataKey="quantity" fill="#16816e" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState />}
            </ChartCard>
            <ChartCard title="Hương vị yêu thích" subtitle="Số lượt được khách hàng lựa chọn">
              <div className="tw-space-y-4 tw-pt-3">
                {report.topFlavors.map((flavor, index) => (
                  <div key={flavor.id} className="tw-flex tw-items-center tw-gap-3">
                    <div className="tw-flex tw-h-9 tw-w-9 tw-items-center tw-justify-center tw-rounded-xl tw-font-black" style={{ backgroundColor: flavor.color }}>
                      {index + 1}
                    </div>
                    <div className="tw-flex-1">
                      <div className="tw-flex tw-justify-between tw-text-sm"><strong>{flavor.name}</strong><span>{flavor.count} lượt</span></div>
                      <div className="tw-mt-2 tw-h-2 tw-rounded-full tw-bg-slate-100 dark:tw-bg-slate-700">
                        <div className="tw-h-full tw-rounded-full tw-bg-lavender-500" style={{ width: `${(flavor.count / Math.max(1, report.topFlavors[0]?.count)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {!report.topFlavors.length && <EmptyState />}
              </div>
            </ChartCard>
          </div>

          <div className="tw-grid tw-gap-5 xl:tw-grid-cols-2">
            <ChartCard title="Cảnh báo sắp hết" subtitle="Nguyên liệu đã chạm mức tồn tối thiểu">
              {report.lowStock.length ? (
                <div className="tw-space-y-3">
                  {report.lowStock.slice(0, 6).map((item) => (
                    <div key={item.id} className="tw-flex tw-items-center tw-gap-3 tw-rounded-2xl tw-bg-amber-50 tw-p-3 dark:tw-bg-amber-900/20">
                      <AlertTriangle size={20} className="tw-text-amber-600" />
                      <div className="tw-flex-1">
                        <strong className="tw-text-sm">{item.ingredient.name}</strong>
                        <div className="tw-text-xs tw-text-slate-500">{item.branch.name}</div>
                      </div>
                      <span className="tw-font-black tw-text-amber-700">{item.quantity.toLocaleString("vi-VN")} {item.ingredient.unit}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="Tồn kho đang ổn định" />}
            </ChartCard>
            <ChartCard title="Cảnh báo hạn sử dụng" subtitle="Các lô sẽ hết hạn trong 14 ngày">
              {report.expiringBatches.length ? (
                <div className="tw-space-y-3">
                  {report.expiringBatches.slice(0, 6).map((batch) => (
                    <div key={batch.id} className="tw-flex tw-items-center tw-gap-3 tw-rounded-2xl tw-bg-blush-50 tw-p-3 dark:tw-bg-blush-500/10">
                      <PackageCheck size={20} className="tw-text-blush-500" />
                      <div className="tw-flex-1">
                        <strong className="tw-text-sm">{batch.ingredient.name}</strong>
                        <div className="tw-text-xs tw-text-slate-500">Lô {batch.batchNumber}</div>
                      </div>
                      <span className="tw-text-sm tw-font-bold tw-text-blush-500">{formatDate(batch.expiryDate)}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="Không có lô sắp hết hạn" />}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
