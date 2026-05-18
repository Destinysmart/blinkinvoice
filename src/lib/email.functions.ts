import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const sendSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  html: z.string().min(1).max(500_000),
  fromName: z.string().max(120).optional(),
  pdfBase64: z.string().max(15_000_000).optional(),
  pdfFileName: z.string().max(200).optional(),
});

export const sendInvoiceEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const { supabase, userId } = context as { supabase: any; userId: string };

    const from = `${data.fromName || "BlinkPay"} <onboarding@resend.dev>`;
    const body: any = {
      from,
      to: [data.to],
      subject: data.subject,
      html: data.html,
    };
    if (data.pdfBase64 && data.pdfFileName) {
      body.attachments = [{ filename: data.pdfFileName, content: data.pdfBase64 }];
    }

    let status: "sent" | "failed" = "sent";
    let error: string | null = null;
    try {
      const res = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        status = "failed";
        const txt = await res.text();
        error = `Resend ${res.status}: ${txt.slice(0, 500)}`;
      }
    } catch (e: any) {
      status = "failed";
      error = e?.message ?? "Network error";
    }

    if (data.invoiceId) {
      await supabase.from("email_logs").insert({
        user_id: userId,
        invoice_id: data.invoiceId,
        recipient_email: data.to,
        subject: data.subject,
        status,
        error,
      });
      if (status === "sent") {
        await supabase
          .from("invoices")
          .update({ status: "pending", sent_at: new Date().toISOString() })
          .eq("id", data.invoiceId)
          .eq("user_id", userId)
          .eq("status", "draft");
      }
    }

    if (status === "failed") throw new Error(error || "Failed to send email");
    return { ok: true };
  });

export const listInvoiceEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: rows, error } = await supabase
      .from("email_logs")
      .select("id, recipient_email, subject, status, error, created_at")
      .eq("invoice_id", data.invoiceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { logs: rows ?? [] };
  });
