import { Controller, Get, Inject } from '@nestjs/common';
import { ADMIN_ROLES } from '@hb/types';
import { Audiences, RequireMfa, Roles } from '../auth/decorators';
import { AdminService } from './admin.service';

/** Admin app only: admin-ish roles, and the session must have completed 2FA. */
@Controller('admin')
@Audiences('admin')
@Roles(...ADMIN_ROLES)
@RequireMfa()
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }
}
