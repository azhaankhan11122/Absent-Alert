export class WhatsAppGateway {
  constructor(config) {
    this.config = config;
  }

  getApiUrl() {
    if (this.config.whatsAppApiUrl) return this.config.whatsAppApiUrl;
    if (this.config.whatsAppPhoneNumberId && this.config.whatsAppApiVersion) {
      return `https://graph.facebook.com/${this.config.whatsAppApiVersion}/${this.config.whatsAppPhoneNumberId}/messages`;
    }
    if (this.config.whatsAppPhoneNumberId) {
      return `https://graph.facebook.com/v17.0/${this.config.whatsAppPhoneNumberId}/messages`;
    }
    throw new Error('WhatsApp API URL is not configured. Set WHATSAPP_API_URL or WHATSAPP_PHONE_NUMBER_ID.');
  }

  validateConfig() {
    if (!this.config.whatsAppAccessToken) {
      throw new Error('WhatsApp access token is missing. Set WHATSAPP_ACCESS_TOKEN.');
    }
    if (!this.config.whatsAppPhoneNumberId && !this.config.whatsAppApiUrl) {
      throw new Error('WhatsApp phone number ID or API URL is required. Set WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_API_URL.');
    }
  }

  async sendWhatsApp(phone, message) {
    this.validateConfig();
    if (!phone) {
      throw new Error('Parent phone number is required for WhatsApp messages.');
    }

    const apiUrl = this.getApiUrl();
    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: {
        body: message
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.whatsAppAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`WhatsApp API request failed (${response.status}): ${body}`);
    }

    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
}
