import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const SendInput = z.object({
  invoiceId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  html: z.string().min(1).max(200_000),
  pdfBase64: z.string().min(1),
  pdfFilename: z.string().min(1).max(200),
  fromName: z.string().min(1).max(120).optional(),
});

export const sendInvoiceEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SendInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

    const fromName = (data.fromName || "BlinkInvoice").replace(/[<>"]/g, "");
    const from = `${fromName} <onboarding@resend.dev>`;

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from,
        to: [data.to],
        subject: data.subject,
        html: data.html,
        attachments: [{ filename: data.pdfFilename, content: data.pdfBase64 }],
      }),
    });

    const body = await res.json().catch(() => ({}));
    const ok = res.ok && !body?.error;
    const errorMsg = ok ? null : (body?.error?.message || body?.message || `Resend ${res.status}`);

    await supabase.from("email_logs").insert({
      user_id: userId,
      invoice_id: data.invoiceId,
      recipient_email: data.to,
      subject: data.subject,
      status: ok ? "sent" : "failed",
      error: errorMsg,
    });

    if (!ok) throw new Error(errorMsg ?? "Failed to send email");
    return { ok: true };
  });

export const listInvoiceEmailLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ invoiceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("email_logs")
      .select("id, recipient_email, subject, status, error, created_at")
      .eq("invoice_id", data.invoiceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { logs: rows ?? [] };
  });
