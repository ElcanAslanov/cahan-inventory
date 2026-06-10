import DashboardShell from "../../components/layout/DashboardShell";
import "../../styles/dashboard.css";
import "@/styles/settings-common.css";

export default function DashboardLayout({ children }) {
  return <DashboardShell>{children}</DashboardShell>;
}