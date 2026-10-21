import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  email: string;
  name?: string;
}

interface BulkEmailRequest {
  subject: string;
  html: string;
  recipients?: Recipient[];
  filter?: {
    source?: string;
    min_visits?: number;
  };
  dry_run?: boolean;
  test_to?: string;
}

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
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
    const { subject, html, filter, dry_run, test_to } = body;

    if (!subject || !html) {
      return new Response(
        JSON.stringify({ error: "subject and html are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Test mode: send to a single address without querying customers
    if (test_to) {
      const testHtml =
        html.replace(/\{\{name\}\}/g, "テスト") +
        `<p style="font-size:11px;color:#999;margin-top:32px;text-align:center;"><a href="#" style="color:#999;">配信停止はこちら</a></p>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({ from: EMAIL_FROM, to: test_to, subject, html: testHtml }),
      });

      const resBody = await res.text();
      return new Response(
        JSON.stringify({ success: res.ok, test_to, response: resBody }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let recipients: Array<{ id?: string; email: string; name?: string | null; phone?: string }>;

    if (body.recipients && body.recipients.length > 0) {
      // Use externally provided recipients (bypasses DB query)
      recipients = body.recipients.map((r) => ({
        email: r.email,
        name: r.name || null,
      }));
    } else {
      // Query eligible recipients from DB
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
      recipients = (customers || []).filter(
        (c) => c.email && !suppressedSet.has(c.email.toLowerCase()),
      );
    }

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

    // Try to create campaign record (non-fatal if DB unavailable)
    let campaignId: string | null = null;
    try {
      const { data: campaign } = await supabase
        .from("bulk_email_campaigns")
        .insert({ subject, body_html: html, total_recipients: recipients.length, status: "sending" })
        .select("id")
        .single();
      campaignId = campaign?.id ?? null;
    } catch (e) {
      console.warn("Could not create campaign record:", e);
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: Array<{ batch: number; status: number; error: string }> = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      // Try to create unsubscribe tokens (non-fatal)
      let tokenMap = new Map<string, string>();
      try {
        const { data: tokens } = await supabase
          .from("email_unsubscribe_tokens")
          .insert(batch.map((r) => ({ email: r.email!.toLowerCase() })))
          .select("email, token");
        tokenMap = new Map(
          (tokens || []).map((t: { email: string; token: string }) => [t.email, t.token]),
        );
      } catch (e) {
        console.warn("Could not create unsubscribe tokens:", e);
      }

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

        const resText = await res.text();
        if (res.ok) {
          sentCount += batch.length;
        } else {
          console.error("Resend batch error:", res.status, resText);
          failedCount += batch.length;
          errors.push({ batch: Math.floor(i / BATCH_SIZE) + 1, status: res.status, error: resText.slice(0, 200) });
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

    // Try to update campaign record (non-fatal)
    if (campaignId) {
      try {
        await supabase
          .from("bulk_email_campaigns")
          .update({
            sent_count: sentCount,
            failed_count: failedCount,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", campaignId);
      } catch (e) {
        console.warn("Could not update campaign record:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaignId,
        total_recipients: recipients.length,
        sent_count: sentCount,
        failed_count: failedCount,
        errors,
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
