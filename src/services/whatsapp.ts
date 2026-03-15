import { env } from "../config/env.js";

const WHATSAPP_API = "https://graph.facebook.com/v19.0";

/**
 * Sends an OTP code via WhatsApp using Meta's Business API
 * @param phone - Phone number in E.164 format (e.g., +5511987654321)
 * @param code - The OTP code to send
 * @returns true if the message was sent successfully, false otherwise
 */
export async function sendOtpWhatsapp(
  phone: string,
  code: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${WHATSAPP_API}/${env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: "otp_auth",
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: code }],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: code }],
              },
            ],
          },
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
