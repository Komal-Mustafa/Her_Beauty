import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ContactSendRequest, ContactVerifyRequest } from '@hb/types';
import { Client, type ClientContext } from '../common/client';
import { parse } from '../common/validate';
import type { AuthContext } from './auth-context';
import { ContactService } from './contact.service';
import { CurrentAuth, PerMinute } from './decorators';

/** The signed-in user confirms their own email or mobile number (docs/b2-auth.md §3). */
@Controller('me/contacts')
export class ContactController {
  constructor(@Inject(ContactService) private readonly contacts: ContactService) {}

  @PerMinute(5)
  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  send(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Client() client: ClientContext) {
    return this.contacts.send(parse(ContactSendRequest.strict(), body), auth, client);
  }

  @PerMinute(10)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Client() client: ClientContext) {
    return this.contacts.verify(parse(ContactVerifyRequest.strict(), body), auth, client);
  }
}
