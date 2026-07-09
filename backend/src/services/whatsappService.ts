export const sendWhatsAppMessage = async (toPhone: string, text: string) => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    throw new Error("WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured");
  }

  // Format the phone number (remove +, spaces, dashes, etc.)
  const formattedPhone = toPhone.replace(/\D/g, "");

  const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "text",
    text: { body: text },
  };

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
    throw new Error(`WhatsApp API error: ${response.status} ${errData}`);
  }

  return await response.json();
};
