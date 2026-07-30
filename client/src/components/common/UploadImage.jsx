import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "react-toastify";
import api, { apiMessage } from "../../services/api";
import Button from "./Button";

export default function UploadImage({ value, onChange }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    setLoading(true);
    try {
      const response = await api.post("/products/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(response.data.data.url);
      toast.success("Tải ảnh thành công");
    } catch (error) {
      toast.error(apiMessage(error, "Không thể tải ảnh"));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <div className="tw-flex tw-items-center tw-gap-4">
      <div className="tw-flex tw-h-24 tw-w-24 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-2xl tw-bg-mint-50 dark:tw-bg-slate-800">
        {value ? (
          <img src={value} alt="Ảnh sản phẩm" className="tw-h-full tw-w-full tw-object-cover" />
        ) : (
          <ImagePlus className="tw-text-mint-500" />
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => upload(event.target.files?.[0])}
        />
        <Button variant="outlined" loading={loading} onClick={() => inputRef.current?.click()}>
          Chọn ảnh
        </Button>
        {value && (
          <Button variant="text" color="error" onClick={() => onChange("")}>
            Bỏ ảnh
          </Button>
        )}
      </div>
    </div>
  );
}

