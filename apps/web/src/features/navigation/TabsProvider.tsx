import { createContext, useContext, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

export type TabId = "calendars" | "create";

const TAB_PATH: Record<TabId, string> = {
  calendars: "/calendars",
  create: "/create",
};

type TabsValue = {
  tab: TabId;
  setTab: (tab: TabId) => void;
};

const TabsContext = createContext<TabsValue | null>(null);

// The URL is the source of truth, so tabs, reloads, redirects and back/forward all stay in sync.
export function TabsProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tab: TabId = pathname.startsWith(TAB_PATH.create) ? "create" : "calendars";

  return (
    <TabsContext.Provider value={{ tab, setTab: (next) => navigate(TAB_PATH[next]) }}>
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs(): TabsValue {
  const value = useContext(TabsContext);
  if (!value) throw new Error("useTabs must be used inside TabsProvider");
  return value;
}
