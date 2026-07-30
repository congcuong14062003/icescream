import { forwardRef } from "react";
import { TextField } from "@mui/material";

const Input = forwardRef(function Input({ label, error, helperText, ...props }, ref) {
  return (
    <TextField
      fullWidth
      label={label}
      error={Boolean(error)}
      helperText={error?.message || helperText}
      inputRef={ref}
      {...props}
    />
  );
});

export default Input;
