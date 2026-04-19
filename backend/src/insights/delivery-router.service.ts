import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service';

export type DeliveryChannel = 'whatsapp';

export interface DeliveryResult {
  channel: DeliveryChannel;
  delivered: boolean;
}

@Injectable()
export class DeliveryRouterService {
  private readonly logger = new Logger(DeliveryRouterService.name);

  constructor(private readonly whatsapp: WhatsappService) {}

  async send(phone: string, message: string): Promise<DeliveryResult> {
    if (!phone) {
      this.logger.warn('No phone number configured — skipping delivery');
      return { channel: 'whatsapp', delivered: false };
    }

    const delivered = await this.whatsapp.sendMessage(phone, message);
    return { channel: 'whatsapp', delivered };
  }
}
