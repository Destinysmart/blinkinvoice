import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/reports")({
  component: () => (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold sm:text-4xl">Reports</h1>
      <EmptyState icon={BarChart3} title="Reports are coming soon"
        description="Revenue, aging, and tax summaries — all in one place." />
    </div>
  ),
});
