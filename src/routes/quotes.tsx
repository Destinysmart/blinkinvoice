import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareQuote } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/quotes")({
  component: () => (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-bold">Quotes</h1>
      <EmptyState icon={MessageSquareQuote} title="Quotes are coming soon"
        description="Send estimates, convert them to invoices in one click." />
    </div>
  ),
});
