import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./layouts/AppShell";
import ProtectedRoute from "./routes/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import NotFoundPage from "./pages/NotFoundPage";
import LoadingSkeleton from "./components/common/LoadingSkeleton";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const PosPage = lazy(() => import("./pages/PosPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const PromotionsPage = lazy(() => import("./pages/PromotionsPage"));
const MembershipPlansPage = lazy(() => import("./pages/MembershipPlansPage"));
const LoyaltySettingsPage = lazy(() => import("./pages/LoyaltySettingsPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const PurchaseOrdersPage = lazy(() => import("./pages/PurchaseOrdersPage"));
const ShiftsPage = lazy(() => import("./pages/ShiftsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function Guard({ permissions, children }) {
  return <ProtectedRoute permissions={permissions}>{children}</ProtectedRoute>;
}

function Page({ children }) {
  return (
    <Suspense fallback={<div className="tw-p-6"><LoadingSkeleton rows={6} /></div>}>
      {children}
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        element={
          <Guard>
            <AppShell />
          </Guard>
        }
      >
        <Route index element={<Guard permissions={["dashboard.view"]}><Page><DashboardPage /></Page></Guard>} />
        <Route path="pos" element={<Guard permissions={["pos.use"]}><Page><PosPage /></Page></Guard>} />
        <Route path="orders" element={<Guard permissions={["orders.view"]}><Page><OrdersPage /></Page></Guard>} />
        <Route path="products" element={<Guard permissions={["products.view"]}><Page><ProductsPage /></Page></Guard>} />
        <Route path="promotions" element={<Guard permissions={["promotions.manage"]}><Page><PromotionsPage /></Page></Guard>} />
        <Route path="memberships" element={<Guard permissions={["promotions.manage"]}><Page><MembershipPlansPage /></Page></Guard>} />
        <Route path="loyalty" element={<Guard permissions={["promotions.manage"]}><Page><LoyaltySettingsPage /></Page></Guard>} />
        <Route path="customers" element={<Guard permissions={["customers.view"]}><Page><CustomersPage /></Page></Guard>} />
        <Route path="inventory" element={<Guard permissions={["inventory.view"]}><Page><InventoryPage /></Page></Guard>} />
        <Route path="purchase-orders" element={<Guard permissions={["inventory.manage"]}><Page><PurchaseOrdersPage /></Page></Guard>} />
        <Route path="shifts" element={<Guard permissions={["shifts.manage"]}><Page><ShiftsPage /></Page></Guard>} />
        <Route path="users" element={<Guard permissions={["users.manage"]}><Page><UsersPage /></Page></Guard>} />
        <Route path="settings" element={<Page><SettingsPage /></Page>} />
      </Route>
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
