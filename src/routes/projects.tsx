import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/projects")({
  component: () => (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-bold">Projects</h1>
      <EmptyState icon={FolderKanban} title="Projects are coming soon"
        description="Group invoices, quotes, and expenses under client projects." />
    </div>
  ),
});
