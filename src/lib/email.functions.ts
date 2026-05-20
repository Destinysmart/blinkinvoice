import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SENDER_DOMAIN = "notify.bitlance.work";
const FROM_ADDRESS = "invoices@notify.bitlance.work";

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

    // 1. Upload PDF to private storage and sign a long-lived URL.
    const pdfBytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    const safeName = data.pdfFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${data.invoiceId}/${Date.now()}-${safeName}`;

    const { error: upErr } = await supabase.storage
      .from("invoice-pdfs")
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`Failed to upload PDF: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabase.storage
      .from("invoice-pdfs")
      .createSignedUrl(path, 60 * 60 * 24 * 60); // 60 days
    if (signErr || !signed?.signedUrl) throw new Error(`Failed to sign PDF URL: ${signErr?.message ?? "unknown"}`);
    const pdfUrl = signed.signedUrl;

    // 2. Inject download button into the HTML (replaces the {{PDF_URL}} placeholder
    //    or appends a button right before </body> as a fallback).
    const downloadBlock = `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">
  <tr><td align="center" style="padding:8px 28px 20px">
    <a href="${pdfUrl}" style="display:inline-block;background:#1c1c1c;border:1px solid #2a2a2a;color:#F7931A;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px">📄 Download invoice PDF</a>
  </td></tr>
</table>`.trim();

    let html = data.html.includes("{{PDF_URL}}")
      ? data.html.replaceAll("{{PDF_URL}}", pdfUrl)
      : data.html.replace("</body>", `${downloadBlock}</body>`);
    if (!html.includes(pdfUrl)) html = html + downloadBlock;

    const fromName = (data.fromName || "BlinkInvoice").replace(/[<>"]/g, "");
    const fromHeader = `${fromName} <${FROM_ADDRESS}>`;
    const messageId = crypto.randomUUID();

    // Plain-text fallback derived from the HTML (Lovable Email API requires `text`).
    const text = html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + `\n\nDownload invoice PDF: ${pdfUrl}\n`;

    // Ensure an unsubscribe token exists for this recipient (Lovable Email requires it for transactional sends).
    let unsubscribeToken: string;
    const { data: existingTok } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", data.to)
      .maybeSingle();
    if (existingTok?.token) {
      unsubscribeToken = existingTok.token;
    } else {
      const newTok = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { data: inserted, error: tokErr } = await supabase
        .from("email_unsubscribe_tokens")
        .insert({ email: data.to, token: newTok })
        .select("token")
        .maybeSingle();
      if (tokErr) {
        const { data: retry } = await supabase
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", data.to)
          .maybeSingle();
        unsubscribeToken = retry?.token ?? newTok;
      } else {
        unsubscribeToken = inserted?.token ?? newTok;
      }
    }

    // 3. Enqueue via Lovable Email queue (auto-retried, rate-limit aware).
    const { error: enqErr } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: data.to,
        from: fromHeader,
        sender_domain: SENDER_DOMAIN,
        subject: data.subject,
        html,
        text,
        purpose: "transactional",
        label: "invoice",
        message_id: messageId,
        unsubscribe_token: unsubscribeToken,
        idempotency_key: `invoice-${data.invoiceId}-${data.to}-${messageId}`,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqErr) {
      await supabase.from("email_logs").insert({
        user_id: userId,
        invoice_id: data.invoiceId,
        recipient_email: data.to,
        subject: data.subject,
        status: "failed",
        error: enqErr.message,
      });
      throw new Error(`Failed to queue email: ${enqErr.message}`);
    }

    await supabase.from("email_logs").insert({
      user_id: userId,
      invoice_id: data.invoiceId,
      recipient_email: data.to,
      subject: data.subject,
      status: "sent",
      error: null,
    });

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
