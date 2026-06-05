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
  type?: "token" | "turn";
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

    const isTurn = body.type === "turn";
    const subject = isTurn
      ? `🔔 It's your turn at ${body.queueName} — Token #${body.tokenNumber}`
      : `You've been added to the queue — Token #${body.tokenNumber}`;

    const heading = isTurn ? "It's your turn! 🔔" : `Hi ${body.name} 👋`;
    const intro = isTurn
      ? `Hi ${body.name}, please proceed to the counter at <strong>${body.queueName}</strong> now.`
      : `You've been added to the queue for <strong>${body.queueName}</strong> by the admin.`;
    const ctaLabel = isTurn ? "Open My Token →" : "View My Token Status →";
    const tokenLabel = isTurn ? "Now Serving" : "Your Token Number";
    const accent = isTurn ? "#16a34a" : "#4f46e5";

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a;background:#ffffff">
        <h2 style="margin:0 0 8px;font-size:22px">${heading}</h2>
        <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.5">${intro}</p>
        <div style="background:#f1f5f9;border-radius:14px;padding:28px;text-align:center;margin:20px 0">
          <p style="margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748b">${tokenLabel}</p>
          <p style="margin:10px 0 0;font-size:54px;font-weight:800;color:${accent};letter-spacing:-0.02em">#${body.tokenNumber}</p>
        </div>
        <p style="text-align:center;margin:24px 0">
          <a href="${body.tokenUrl}" style="background:${accent};color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;display:inline-block;font-size:15px">${ctaLabel}</a>
        </p>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:32px">Powered by QueueSnap • No account needed</p>
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
        subject,
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
