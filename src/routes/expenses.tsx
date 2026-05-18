import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/expenses")({
  component: () => (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold sm:text-4xl">Expenses</h1>
      <EmptyState icon={Package} title="Expenses are coming soon"
        description="Track business costs against projects and clients." />
    </div>
  ),
});
