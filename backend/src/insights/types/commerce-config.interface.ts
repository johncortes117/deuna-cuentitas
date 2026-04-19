export interface CommerceConfig {
  commerceId: string;
  name: string;
  whatsappPhone: string;
  proactiveEnabled: boolean;
  /** Rule IDs to evaluate for this commerce. */
  enabledRules: string[];
  timezone: string;
}
