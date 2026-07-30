import { Link } from "react-router-dom";
import { IceCreamBowl } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="ice-gradient tw-flex tw-min-h-screen tw-flex-col tw-items-center tw-justify-center tw-p-6 tw-text-center">
      <IceCreamBowl size={64} className="tw-text-mint-500" />
      <h1 className="tw-mb-2 tw-mt-5 tw-text-4xl tw-font-black">Trang không tồn tại</h1>
      <p className="tw-text-slate-500">Có vẻ món kem bạn tìm đã được bán hết.</p>
      <Link to="/" className="tw-mt-4 tw-rounded-2xl tw-bg-mint-500 tw-px-5 tw-py-3 tw-font-bold tw-text-white tw-no-underline">
        Về trang tổng quan
      </Link>
    </div>
  );
}

