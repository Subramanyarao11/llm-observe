import { Link, Outlet, useLocation } from "react-router-dom";

const nav = [
  { to: "/conversations", label: "Conversations" },
  { to: "/dashboard", label: "Dashboard" },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-emerald-400">
            LLM Observe
          </Link>
          <nav className="flex gap-4">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={
                  location.pathname.startsWith(item.to)
                    ? "text-emerald-400"
                    : "text-slate-400 hover:text-slate-200"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
