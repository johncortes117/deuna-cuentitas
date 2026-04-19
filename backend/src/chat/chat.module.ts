import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AgentService } from './agent.service';

@Module({
  imports: [AnalyticsModule],
  controllers: [ChatController],
  providers: [ChatService, AgentService],
})
export class ChatModule {}
