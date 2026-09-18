import { forwardRef } from "react";
import Input from "./Input";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatThousands(value) {
  const digits = digitsOnly(value);
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
}

const MoneyInput = forwardRef(function MoneyInput({ value, onChange, inputProps, ...props }, ref) {
  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={formatThousands(value)}
      inputProps={{ ...inputProps, min: undefined }}
      onChange={(event) => {
        const digits = digitsOnly(event.target.value);
        onChange?.(digits === "" ? 0 : Number(digits));
      }}
    />
  );
});

export default MoneyInput;