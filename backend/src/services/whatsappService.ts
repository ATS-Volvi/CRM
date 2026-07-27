import dotenv from "dotenv";
dotenv.config();

export const sendWhatsAppMessage = async (toPhone: string, text: string, mediaUrl?: string) => {
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Format the phone number (remove +, spaces, dashes, etc.)
  const formattedPhone = toPhone.replace(/\D/g, "");

  if (!token || !phoneId) {
    console.warn(`[WhatsApp Service] WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured. Simulating send to ${formattedPhone}`);
    return {
      messaging_product: "whatsapp",
      contacts: [{ input: formattedPhone, wa_id: formattedPhone }],
      messages: [{ id: `wamid.simulated_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` }],
      simulated: true
    };
  }

  const url = `https://graph.facebook.com/v25.0/${phoneId}/messages`;
  let payload: any = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "text",
    text: { body: text },
  };

  if (mediaUrl) {
    const isPdf = mediaUrl.endsWith(".pdf");
    payload = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: isPdf ? "document" : "image",
      [isPdf ? "document" : "image"]: {
        link: mediaUrl,
        caption: text
      }
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.text();
    console.error(`[WhatsApp API Error] ${response.status}: ${errData}`);
    throw new Error(`WhatsApp API error: ${response.status} ${errData}`);
  }

  return await response.json();
};
