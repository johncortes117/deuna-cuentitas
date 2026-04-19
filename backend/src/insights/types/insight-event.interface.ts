export interface InsightEvent {
  ruleId: string;
  commerceId: string;
  priority: 'high' | 'medium' | 'low';
  data: Record<string, unknown>;
}
