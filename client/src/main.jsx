import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import App from "./App";
import { AuthProvider } from "./store/AuthContext";
import { ColorModeProvider, useColorMode } from "./store/ColorModeContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Root() {
  const { muiTheme, mode } = useColorMode();
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <App />
            <ToastContainer
              position="top-right"
              autoClose={3000}
              theme={mode}
              closeOnClick
            />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ColorModeProvider>
      <Root />
    </ColorModeProvider>
  </React.StrictMode>,
);
