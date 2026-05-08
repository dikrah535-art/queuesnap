const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  email: string;
  name: string;
  tokenNumber: number | string;
  queueName: string;
  tokenUrl: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = (await req.json()) as Body;
    if (!body?.email || !body?.name || body.tokenNumber === undefined || !body?.queueName || !body?.tokenUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 8px">Hi ${body.name} 👋</h2>
        <p style="margin:0 0 16px;color:#475569">You've been added to the queue for <strong>${body.queueName}</strong>.</p>
        <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin:16px 0">
          <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Your Token Number</p>
          <p style="margin:8px 0 0;font-size:44px;font-weight:700;color:#2563eb">#${body.tokenNumber}</p>
        </div>
        <p style="text-align:center;margin:24px 0">
          <a href="${body.tokenUrl}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">View My Token Status →</a>
        </p>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:32px">Powered by QueueSnap</p>
      </div>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "QueueSnap <onboarding@resend.dev>",
        to: body.email,
        subject: `Your Queue Token #${body.tokenNumber} — ${body.queueName}`,
        html,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ error: data?.message ?? "Send failed", details: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
