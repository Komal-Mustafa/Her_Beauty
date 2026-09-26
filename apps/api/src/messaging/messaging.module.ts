import { Global, Module } from '@nestjs/common';
import { LogMessageProvider, MESSAGE_PROVIDER } from './message-provider';

/** Tests swap the provider: `.overrideProvider(MESSAGE_PROVIDER).useValue(new MemoryMessageProvider())`. */
@Global()
@Module({
  providers: [{ provide: MESSAGE_PROVIDER, useClass: LogMessageProvider }],
  exports: [MESSAGE_PROVIDER],
})
export class MessagingModule {}
