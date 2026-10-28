import { PageLoader } from "@/components/ui/spinner";

// Shown inside the dashboard layout (header and menu stay put) while any dashboard page loads.
export default function DashboardLoading() {
  return <PageLoader label="Loading your dashboard" />;
}
