import { Button as MuiButton, CircularProgress } from "@mui/material";

export default function Button({ loading = false, children, disabled, ...props }) {
  return (
    <MuiButton
      variant="contained"
      disableElevation
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : props.startIcon}
      {...props}
    >
      {children}
    </MuiButton>
  );
}

