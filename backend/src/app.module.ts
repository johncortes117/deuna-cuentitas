import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { DbModule } from './db/db.module';
import { RedisModule } from './redis/redis.module';
import { ChatModule } from './chat/chat.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { InsightsModule } from './insights/insights.module';

@Module({
  imports: [PrismaModule, DbModule, RedisModule, ChatModule, WhatsappModule, InsightsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
