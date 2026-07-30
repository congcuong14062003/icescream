import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createTheme } from "@mui/material";

const ColorModeContext = createContext(null);

export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem("icecream-theme") || "light");

  useEffect(() => {
    const isDark = mode === "dark";
    document.documentElement.classList.toggle("tw-dark", isDark);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const toggleMode = () => {
    setMode((current) => {
      const next = current === "light" ? "dark" : "light";
      localStorage.setItem("icecream-theme", next);
      return next;
    });
  };
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: "#16816e", dark: "#10443d", light: "#40bea3", contrastText: "#ffffff" },
          secondary: { main: "#8b70dd" },
          background: {
            default: mode === "light" ? "#f3f6f5" : "#0b1211",
            paper: mode === "light" ? "#ffffff" : "#111b19",
          },
          text: {
            primary: mode === "light" ? "#172421" : "#edf5f2",
            secondary: mode === "light" ? "#657570" : "#93a39f",
          },
          divider: mode === "light" ? "#e2e9e7" : "#24312e",
        },
        shape: { borderRadius: 12 },
        typography: {
          fontFamily: 'Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif',
          h1: { fontWeight: 800, letterSpacing: "-0.035em" },
          h2: { fontWeight: 800, letterSpacing: "-0.03em" },
          h3: { fontWeight: 750, letterSpacing: "-0.02em" },
          button: { textTransform: "none", fontWeight: 700, letterSpacing: "-0.01em" },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 11,
                minHeight: 42,
                paddingInline: 16,
                boxShadow: "none",
              },
              containedPrimary: {
                background: "linear-gradient(135deg, #16816e 0%, #14675a 100%)",
                "&:hover": {
                  boxShadow: "0 8px 18px rgba(20, 103, 90, 0.22)",
                },
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: 18,
                border: `1px solid ${mode === "light" ? "#e2e9e7" : "#24312e"}`,
                boxShadow: "0 24px 70px rgba(4, 29, 25, 0.22)",
              },
            },
          },
          MuiTextField: {
            defaultProps: { size: "small" },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: 11,
                backgroundColor: mode === "light" ? "#ffffff" : "#111b19",
                "& fieldset": { borderColor: mode === "light" ? "#dce5e2" : "#31413d" },
                "&:hover fieldset": { borderColor: "#78b8aa" },
              },
            },
          },
          MuiInputLabel: {
            styleOverrides: { root: { fontWeight: 600 } },
          },
          MuiIconButton: {
            styleOverrides: { root: { borderRadius: 10 } },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderColor: mode === "light" ? "#edf1f0" : "#24312e",
                paddingTop: 13,
                paddingBottom: 13,
              },
              head: {
                color: mode === "light" ? "#657570" : "#93a39f",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              },
            },
          },
          MuiTooltip: {
            styleOverrides: { tooltip: { borderRadius: 8, fontWeight: 600 } },
          },
        },
      }),
    [mode],
  );
  const value = useMemo(() => ({ mode, toggleMode, muiTheme }), [mode, muiTheme]);
  return (
    <ColorModeContext.Provider value={value}>
      <div className={mode === "dark" ? "tw-dark dark" : ""}>{children}</div>
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (!context) throw new Error("useColorMode must be used inside ColorModeProvider");
  return context;
}
