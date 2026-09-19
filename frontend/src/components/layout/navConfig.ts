import {
  Database,
  LineChart,
  MessageSquare,
  ScrollText,
  Shield,
  Terminal,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/ask", label: "Ask", icon: MessageSquare },
  { to: "/sql", label: "SQL", icon: Terminal },
  { to: "/schema", label: "Schema", icon: Database },
  { to: "/metrics", label: "Metrics", icon: LineChart },
  { to: "/govern", label: "Govern", icon: Shield },
  { to: "/audit", label: "Audit", icon: ScrollText },
];
