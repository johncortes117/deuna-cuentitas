import { InsightRule } from '../types/insight-rule.interface';
import { dailyRecordRule } from './daily-record.rule';
import { dayClosingRule } from './day-closing.rule';
import { returningClientRule } from './returning-client.rule';
import { slowStartRule } from './slow-start.rule';

export const INSIGHT_RULES: InsightRule[] = [
  dailyRecordRule,
  slowStartRule,
  returningClientRule,
  dayClosingRule,
];
