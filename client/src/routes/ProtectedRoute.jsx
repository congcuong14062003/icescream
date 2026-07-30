import { Navigate, useLocation } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { useAuth } from "../store/AuthContext";
import LoadingSkeleton from "../components/common/LoadingSkeleton";

export default function ProtectedRoute({ children, permissions = [] }) {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="ice-gradient tw-flex tw-min-h-screen tw-items-center tw-justify-center tw-p-8">
        <div className="tw-w-full tw-max-w-md"><LoadingSkeleton rows={4} /></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (permissions.length && !hasPermission(...permissions)) {
    return (
      <div className="tw-flex tw-min-h-screen tw-flex-col tw-items-center tw-justify-center tw-gap-3 tw-p-6 tw-text-center">
        <ShieldX size={48} className="tw-text-rose-500" />
        <h1 className="tw-m-0 tw-text-2xl tw-font-black">Không có quyền truy cập</h1>
        <p className="tw-m-0 tw-text-slate-500">Tài khoản của bạn không có quyền mở màn hình này.</p>
      </div>
    );
  }
  return children;
}

