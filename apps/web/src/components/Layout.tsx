import { Link, Outlet, useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const nav = [
  { to: "/conversations", label: "Conversations" },
  { to: "/dashboard", label: "Dashboard" },
];

export function Layout() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            LLM Observe
          </Link>
          <div className="flex items-center gap-3">
            <nav className="flex gap-1">
              {nav.map((item) => {
                const active = location.pathname.startsWith(item.to);
                return (
                  <Link key={item.to} to={item.to} className="relative px-3 py-2 text-sm">
                    <span
                      className={cn(
                        "transition-colors",
                        active
                          ? "text-neutral-900 dark:text-neutral-100"
                          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
                      )}
                    >
                      {item.label}
                    </span>
                    {active ? (
                      <motion.span
                        layoutId="nav-indicator"
                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-neutral-900 dark:bg-neutral-100"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <Button variant="outline" size="icon" onClick={toggleTheme}>
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
