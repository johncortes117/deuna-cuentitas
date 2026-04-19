import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ChatModule } from './chat/chat.module';
import { DbModule } from './db/db.module';

@Module({
  imports: [PrismaModule, DbModule, ChatModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
