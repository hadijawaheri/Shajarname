import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MembersService } from 'src/members/members.service';
import { AuditService } from 'src/audit/audit.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import {
  GrantLoginDto,
  ResetUserPasswordDto,
  SetUserRoleDto,
} from './dto/users.dto';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';

type AuthReq = { user?: { id?: string; mobile?: string; role?: string } };

@Controller({ version: '1', path: 'users' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly auditService: AuditService,
  ) {}

  @Get('/')
  async listAccounts() {
    const users = await this.membersService.listLoginAccounts();
    return { users };
  }

  @Get('/audit')
  async listAudit(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 50;
    const logs = await this.auditService.listRecent(
      Number.isFinite(n) ? n : 50,
    );
    return { logs };
  }

  @Put('/:id/role')
  async setRole(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: SetUserRoleDto,
    @Req() req: AuthReq,
  ) {
    const { member, previousRole } = await this.membersService.setMemberRole(
      id,
      body.role,
    );
    await this.auditService.record({
      action: 'user.role_changed',
      actorId: req.user?.id || '',
      actorMobile: req.user?.mobile,
      targetId: member._id.toString(),
      targetMobile: member.mobile,
      targetName: `${member.name} ${member.lastName}`.trim(),
      meta: { from: previousRole, to: body.role },
    });
    return {
      member: {
        id: member._id.toString(),
        name: member.name,
        lastName: member.lastName,
        mobile: member.mobile,
        role: member.role,
      },
    };
  }

  @Put('/:id/password')
  async resetPassword(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: ResetUserPasswordDto,
    @Req() req: AuthReq,
  ) {
    const { member } = await this.membersService.resetMemberPassword(
      id,
      body.password,
    );
    await this.auditService.record({
      action: 'user.password_reset',
      actorId: req.user?.id || '',
      actorMobile: req.user?.mobile,
      targetId: member._id.toString(),
      targetMobile: member.mobile,
      targetName: `${member.name} ${member.lastName}`.trim(),
      meta: {},
    });
    return { success: true };
  }

  @Post('/:id/login')
  async grantLogin(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() body: GrantLoginDto,
    @Req() req: AuthReq,
  ) {
    const { member, previousRole, previousMobile } =
      await this.membersService.grantLoginAccess(id, body);
    await this.auditService.record({
      action: 'user.login_granted',
      actorId: req.user?.id || '',
      actorMobile: req.user?.mobile,
      targetId: member._id.toString(),
      targetMobile: member.mobile,
      targetName: `${member.name} ${member.lastName}`.trim(),
      meta: {
        role: member.role,
        previousRole,
        mobileChanged: previousMobile !== member.mobile,
      },
    });
    return {
      member: {
        id: member._id.toString(),
        name: member.name,
        lastName: member.lastName,
        mobile: member.mobile,
        role: member.role,
      },
    };
  }

  @Delete('/:id/login')
  async revokeLogin(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthReq,
  ) {
    const { member, previousRole } =
      await this.membersService.revokeLoginAccess(id);
    await this.auditService.record({
      action: 'user.login_revoked',
      actorId: req.user?.id || '',
      actorMobile: req.user?.mobile,
      targetId: member._id.toString(),
      targetMobile: member.mobile,
      targetName: `${member.name} ${member.lastName}`.trim(),
      meta: { previousRole },
    });
    return { success: true };
  }
}
