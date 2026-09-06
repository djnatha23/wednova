const json = (statusCode, body) => new Response(JSON.stringify(body), {
  status: statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  }
});

const clean = (value, max = 2000) => String(value ?? "").trim().slice(0, max);

const escapeWhatsAppText = (value) => clean(value).replace(/[<>]/g, "");

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { message: "Método no permitido." });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json(400, { message: "La solicitud no tiene un formato válido." });
  }

  const name = clean(data.name, 120);
  const contact = clean(data.contact, 80);
  const projectType = clean(data.projectType, 120);
  const goal = clean(data.goal, 2000);

  if (!name || !contact || !projectType || !goal) {
    return json(400, { message: "Completa tu nombre, WhatsApp, tipo de proyecto y objetivo." });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient = process.env.WHATSAPP_TO_NUMBER || "18094238579";
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0";

  if (!accessToken || !phoneNumberId) {
    console.error("Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID en Netlify.");
    return json(503, { message: "La recepción por WhatsApp todavía está en configuración. Escríbenos directamente mientras la activamos." });
  }

  const features = Array.isArray(data.features) ? data.features.map((item) => clean(item, 120)).filter(Boolean) : [];
  const lines = [
    "*Nueva solicitud para WedNova*",
    "",
    "*DATOS DEL CLIENTE*",
    `Nombre: ${escapeWhatsAppText(name)}`,
    `WhatsApp: ${escapeWhatsAppText(contact)}`,
    "",
    "*PROYECTO*",
    `Tipo: ${escapeWhatsAppText(projectType)}`,
    `Objetivo: ${escapeWhatsAppText(goal)}`,
    `Funciones: ${escapeWhatsAppText(features.length ? features.join(", ") : "Por definir")}`,
    `Secciones: ${escapeWhatsAppText(data.sections || "Por definir")}`,
    `Estilo: ${escapeWhatsAppText(data.style || "Por definir")}`,
    `Contenido: ${escapeWhatsAppText(data.content || "Por definir")}`,
    `Integraciones: ${escapeWhatsAppText(data.integrations || "Ninguna indicada")}`,
    `Presupuesto: ${escapeWhatsAppText(data.budget || "Prefiere conversarlo")}`,
    `Fecha ideal: ${escapeWhatsAppText(data.deadline || "Lo antes posible")}`,
    `Detalles extra: ${escapeWhatsAppText(data.extra || "Ninguno")}`
  ];

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: { preview_url: false, body: lines.join("\n") }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("WhatsApp Cloud API error", response.status, details);
    return json(502, { message: "No pudimos enviar la notificación por WhatsApp. Inténtalo nuevamente." });
  }

  return json(200, { ok: true });
};
