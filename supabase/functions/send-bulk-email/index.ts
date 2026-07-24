import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface BulkEmailRequest {
  subject: string;
  html: string;
  filter?: {
    source?: string;
    min_visits?: number;
  };
  dry_run?: boolean;
}

const BATCH_SIZE = 50;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "noreply@u-sync.jp";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body: BulkEmailRequest = await req.json();
    const { subject, html, filter, dry_run } = body;

    if (!subject || !html) {
      return new Response(
        JSON.stringify({ error: "subject and html are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Query eligible recipients
    let query = supabase
      .from("customers")
      .select("id, email, name, phone")
      .eq("marketing_email_opt_in", true)
      .not("email", "is", null);

    if (filter?.source) query = query.eq("source", filter.source);
    if (filter?.min_visits) query = query.gte("visit_count", filter.min_visits);

    const { data: customers, error: customersError } = await query;
    if (customersError) throw customersError;

    // Exclude suppressed emails
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email");

    const suppressedSet = new Set(
      (suppressed || []).map((s: { email: string }) => s.email.toLowerCase()),
    );
    const recipients = (customers || []).filter(
      (c) => c.email && !suppressedSet.has(c.email.toLowerCase()),
    );

    if (dry_run) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          recipient_count: recipients.length,
          recipients: recipients.map((r) => ({ name: r.name, email: r.email })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No eligible recipients", sent_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabase
      .from("bulk_email_campaigns")
      .insert({ subject, body_html: html, total_recipients: recipients.length, status: "sending" })
      .select("id")
      .single();
    if (campaignError) throw campaignError;

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      // Create unsubscribe tokens for this batch
      const { data: tokens } = await supabase
        .from("email_unsubscribe_tokens")
        .insert(batch.map((r) => ({ email: r.email!.toLowerCase() })))
        .select("email, token");

      const tokenMap = new Map(
        (tokens || []).map((t: { email: string; token: string }) => [t.email, t.token]),
      );

      const emails = batch.map((r) => {
        const token = tokenMap.get(r.email!.toLowerCase());
        const unsubscribeUrl = token
          ? `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`
          : "";

        const personalizedHtml =
          html.replace(/\{\{name\}\}/g, r.name || "お客様") +
          (unsubscribeUrl
            ? `<p style="font-size:11px;color:#999;margin-top:32px;text-align:center;"><a href="${unsubscribeUrl}" style="color:#999;">配信停止はこちら</a></p>`
            : "");

        return {
          from: EMAIL_FROM,
          to: r.email!,
          subject,
          html: personalizedHtml,
        };
      });

      try {
        const res = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify(emails),
        });

        if (res.ok) {
          sentCount += batch.length;
          await supabase.from("email_send_log").insert(
            batch.map((r) => ({
              to_email: r.email!,
              template_key: `bulk_${campaign.id}`,
              status: "sent",
              idempotency_key: `bulk_${campaign.id}_${r.id}`,
            })),
          );
        } else {
          const errorText = await res.text();
          console.error("Resend batch error:", res.status, errorText);
          failedCount += batch.length;
          await supabase.from("email_send_log").insert(
            batch.map((r) => ({
              to_email: r.email!,
              template_key: `bulk_${campaign.id}`,
              status: "failed",
              error_message: errorText.slice(0, 500),
              idempotency_key: `bulk_${campaign.id}_${r.id}`,
            })),
          );
        }
      } catch (error) {
        console.error("Batch send error:", error);
        failedCount += batch.length;
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    await supabase
      .from("bulk_email_campaigns")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaign.id,
        total_recipients: recipients.length,
        sent_count: sentCount,
        failed_count: failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in send-bulk-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
