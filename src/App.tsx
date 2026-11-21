import { useEffect } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useApp } from "@/state/store";
import { Spinner } from "@/components/ui";
import Home from "@/pages/Home";
import Create from "@/pages/Create";
import Projects from "@/pages/Projects";
import Workspace from "@/pages/Workspace";
import BuildMode from "@/pages/BuildMode";
import Manual from "@/pages/Manual";
import Learn from "@/pages/Learn";
import LessonPage from "@/pages/LessonPage";
import ToolLibrary from "@/pages/ToolLibrary";
import MaterialsLibrary from "@/pages/MaterialsLibrary";
import Assistant from "@/pages/Assistant";
import SettingsPage from "@/pages/Settings";

const NAV = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/create", label: "Create a Project", icon: "✦" },
  { to: "/projects", label: "My Projects", icon: "▤" },
  { to: "/learn", label: "Learn Woodworking", icon: "✎" },
  { to: "/tools", label: "Tool Library", icon: "⚒" },
  { to: "/materials", label: "Materials Library", icon: "▦" },
  { to: "/assistant", label: "AI Assistant", icon: "◌" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export default function App() {
  const { loaded, load } = useApp();
  const loc = useLocation();
  useEffect(() => {
    load();
  }, [load]);
  // Full-screen experiences without the sidebar.
  const bare = /\/(build|manual)$/.test(loc.pathname);

  if (!loaded)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );

  const routes = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<Create />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/:id" element={<Workspace />} />
      <Route path="/projects/:id/build" element={<BuildMode />} />
      <Route path="/projects/:id/manual" element={<Manual />} />
      <Route path="/learn" element={<Learn />} />
      <Route path="/learn/:key" element={<LessonPage />} />
      <Route path="/tools" element={<ToolLibrary />} />
      <Route path="/materials" element={<MaterialsLibrary />} />
      <Route path="/assistant" element={<Assistant />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
  if (bare) return routes;

  return (
    <div className="flex h-full">
      <aside className="no-print flex w-60 shrink-0 flex-col border-r border-cream-200 bg-cream-50">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-wood-600 text-lg font-bold text-cream-50">W</div>
            <div>
              <div className="text-lg font-semibold leading-tight">Woodly</div>
              <div className="text-[11px] text-charcoal-700/70">Imagine. Design. Build.</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-wood-600/10 text-wood-700" : "text-charcoal-700 hover:bg-cream-200"}`
              }
            >
              <span className="w-4 text-center opacity-70">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 text-[11px] leading-snug text-charcoal-700/60">
          Plans are generated and checked automatically but are not engineer-verified. Always use judgment and follow tool safety instructions.
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">{routes}</main>
    </div>
  );
}
