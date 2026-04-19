import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { NlpService } from './nlp.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, NlpService],
})
export class ChatModule {}
