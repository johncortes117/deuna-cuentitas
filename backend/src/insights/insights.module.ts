import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsModule } from '../analytics/analytics.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { InsightDetectorService } from './insight-detector.service';
import { InsightFormatterService } from './insight-formatter.service';
import { InsightThrottleService } from './insight-throttle.service';
import { DeliveryRouterService } from './delivery-router.service';
import { ProactiveSchedulerService } from './proactive-scheduler.service';
import { InsightsController } from './insights.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AnalyticsModule,
    WhatsappModule,
  ],
  providers: [
    InsightDetectorService,
    InsightThrottleService,
    InsightFormatterService,
    DeliveryRouterService,
    ProactiveSchedulerService,
  ],
  controllers: [InsightsController],
  exports: [ProactiveSchedulerService, InsightThrottleService],
})
export class InsightsModule {}
