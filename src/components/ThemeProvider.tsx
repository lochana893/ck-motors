"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener("ck-motors-theme-change", onStoreChange);

    return () => {
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener("ck-motors-theme-change", onStoreChange);
    };
  }, []);

  const getSnapshot = useCallback((): Theme => {
    return window.localStorage.getItem("ck-motors-theme") === "dark"
      ? "dark"
      : "light";
  }, []);

  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    (): Theme => "light"
  );

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => {
        const nextTheme = theme === "light" ? "dark" : "light";
        window.localStorage.setItem("ck-motors-theme", nextTheme);
        window.dispatchEvent(new Event("ck-motors-theme-change"));
      },
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className="theme-root" data-theme={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
