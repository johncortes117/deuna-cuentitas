import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';

// --single-process is incompatible with Chromium on Windows and causes an immediate crash
const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
];

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private client: Client;
  private isReady = false;
  private initFailed = false;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: './data/whatsapp-auth' }),
      puppeteer: { args: PUPPETEER_ARGS },
    });

    this.client.on('qr', (qr) => {
      this.logger.log('Scan the QR code below to authenticate WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      this.logger.log('WhatsApp Client is ready!');
      this.isReady = true;
      this.initFailed = false;
    });

    this.client.on('auth_failure', (msg) => {
      this.logger.error(`WhatsApp authentication failed: ${msg}`);
      this.isReady = false;
    });

    this.client.on('disconnected', (reason) => {
      this.logger.warn(`WhatsApp Client disconnected: ${reason}`);
      this.isReady = false;
    });
  }

  async onModuleInit() {
    this.logger.log('Initializing WhatsApp Client...');
    try {
      await this.client.initialize();
    } catch (error) {
      // Do not crash the app — other modules (chat, insights API) must keep working
      this.initFailed = true;
      this.logger.error(
        'WhatsApp Client failed to initialize. Proactive messaging will be disabled. ' +
          'Check that Chromium/Chrome is available and try restarting.',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async onModuleDestroy() {
    if (!this.initFailed) {
      try {
        await this.client.destroy();
      } catch {
        // ignore cleanup errors on shutdown
      }
    }
  }

  async sendMessage(phone: string, text: string): Promise<boolean> {
    if (!this.isReady) {
      this.logger.warn('WhatsApp is not ready — message not sent');
      return false;
    }

    const formattedPhone = phone.includes('@c.us')
      ? phone
      : `${phone.replace(/\D/g, '')}@c.us`;

    try {
      await this.client.sendMessage(formattedPhone, text);
      this.logger.log(`Message sent to ${formattedPhone}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to ${formattedPhone}`, error);
      return false;
    }
  }

  get ready(): boolean {
    return this.isReady;
  }
}
