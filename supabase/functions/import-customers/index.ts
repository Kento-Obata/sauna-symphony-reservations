import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface CustomerRow {
  name: string;
  email?: string;
  phone: string;
}

interface ImportRequest {
  customers?: CustomerRow[];
  csv?: string;
  source?: string;
  set_marketing_opt_in?: boolean;
}

function parseCsv(csv: string): CustomerRow[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const nameIdx = header.findIndex((h) =>
    ["name", "名前", "氏名", "お名前", "顧客名"].includes(h)
  );
  const emailIdx = header.findIndex((h) =>
    ["email", "mail", "メール", "メールアドレス", "e-mail"].includes(h)
  );
  const phoneIdx = header.findIndex((h) =>
    ["phone", "tel", "電話", "電話番号", "携帯", "携帯電話"].includes(h)
  );

  if (phoneIdx === -1) {
    throw new Error(
      "CSV must have a phone column (phone/tel/電話/電話番号)",
    );
  }

  const rows: CustomerRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const phone = normalizePhone(cols[phoneIdx] || "");
    if (!phone) continue;

    rows.push({
      name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
      email: emailIdx >= 0 ? cols[emailIdx] || undefined : undefined,
      phone,
    });
  }
  return rows;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[-\s\u3000()（）]/g, "");
  if (digits.startsWith("+81")) return "0" + digits.slice(3);
  if (digits.startsWith("81") && digits.length >= 11) return "0" + digits.slice(2);
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ImportRequest = await req.json();
    const source = body.source || "import";
    const setOptIn = body.set_marketing_opt_in ?? false;

    let rows: CustomerRow[];
    if (body.csv) {
      rows = parseCsv(body.csv);
    } else if (body.customers) {
      rows = body.customers.map((c) => ({
        ...c,
        phone: normalizePhone(c.phone),
      }));
    } else {
      return new Response(
        JSON.stringify({ error: "customers array or csv string is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, updated: 0, skipped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Filter out rows without valid phone
    const validRows = rows.filter((r) => r.phone && r.phone.length >= 10);
    const skipped = rows.length - validRows.length;

    let imported = 0;
    let updated = 0;

    // Process in batches to avoid large payloads
    const BATCH = 100;
    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH);

      // Check which phones already exist
      const phones = batch.map((r) => r.phone);
      const { data: existing } = await supabase
        .from("customers")
        .select("phone")
        .in("phone", phones);

      const existingSet = new Set((existing || []).map((e: { phone: string }) => e.phone));

      const toInsert = batch
        .filter((r) => !existingSet.has(r.phone))
        .map((r) => ({
          phone: r.phone,
          email: r.email || null,
          name: r.name || null,
          source,
          marketing_email_opt_in: setOptIn,
        }));

      const toUpdate = batch.filter((r) => existingSet.has(r.phone));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("customers").insert(toInsert);
        if (error) console.error("Insert error:", error);
        else imported += toInsert.length;
      }

      for (const row of toUpdate) {
        const updateData: Record<string, unknown> = {};
        if (row.email) updateData.email = row.email;
        if (row.name) updateData.name = row.name;
        if (setOptIn) updateData.marketing_email_opt_in = true;

        if (Object.keys(updateData).length > 0) {
          await supabase.from("customers").update(updateData).eq("phone", row.phone);
          updated++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, imported, updated, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in import-customers:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
