import { forwardRef } from "react";
import { FormControl, FormHelperText, InputLabel, MenuItem, Select as MuiSelect } from "@mui/material";

const Select = forwardRef(function Select({ label, options = [], error, value = "", ...props }, ref) {
  const labelId = `${props.name || label}-label`;
  return (
    <FormControl fullWidth size="small" error={Boolean(error)}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <MuiSelect labelId={labelId} label={label} value={value} inputRef={ref} {...props}>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </MuiSelect>
      {error && <FormHelperText>{error.message}</FormHelperText>}
    </FormControl>
  );
});

export default Select;
