import { CommerceConfig } from './types/commerce-config.interface';

/**
 * MVP: commerce configs live here as constants.
 * Production path: migrate to a database table or config service.
 */
export function getCommerceConfigs(): CommerceConfig[] {
  return [
    {
      commerceId: 'NEG001',
      name: 'Tienda de Carmita',
      whatsappPhone: process.env.DEMO_DESTINATION_PHONE ?? '',
      proactiveEnabled: Boolean(process.env.DEMO_DESTINATION_PHONE),
      enabledRules: ['daily_record', 'slow_start', 'returning_client', 'day_closing'],
      timezone: 'America/Guayaquil',
    },
    {
      commerceId: 'NEG002',
      name: 'Cafetería Don Roberto',
      whatsappPhone: process.env.DEMO_DESTINATION_PHONE_2 ?? '',
      proactiveEnabled: Boolean(process.env.DEMO_DESTINATION_PHONE_2),
      enabledRules: ['daily_record', 'slow_start', 'day_closing'],
      timezone: 'America/Guayaquil',
    },
  ];
}

export function getCommerceConfig(commerceId: string): CommerceConfig | undefined {
  return getCommerceConfigs().find((c) => c.commerceId === commerceId);
}
