import DashboardShell from "../../components/layout/DashboardShell";
import "../../styles/dashboard.css";

export default function DashboardLayout({ children }) {
  return <DashboardShell>{children}</DashboardShell>;
}