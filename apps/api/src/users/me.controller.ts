import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { UpdateMeRequest } from '@hb/types';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { parse } from '../common/validate';
import { UsersService } from './users.service';

/** The signed-in user's own profile (any app). */
@Controller('me')
export class MeController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  me(@CurrentAuth() auth: AuthContext) {
    return this.users.me(auth.userId);
  }

  /** Only `fullName` can change here; any other field is a 400. */
  @Patch()
  update(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    const { fullName } = parse(UpdateMeRequest.strict(), body);
    return this.users.updateName(auth.userId, fullName);
  }
}
