// NestJS
import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, BadRequestException,
  UseGuards, UseInterceptors, UploadedFile, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { MembersService } from './members.service';
import { UploadService } from './upload.service';
import { CreateMemberDto, EditMemberDto } from './dtos';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { canManageUsers } from 'src/common/constants/roles';

@Controller({ version: '1', path: 'members' })
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly uploadService: UploadService,
  ) {}

  /** Editors may mutate tree data but cannot set login credentials / roles. */
  private stripAccountFields<T extends { role?: string; password?: string }>(
    dto: T,
    userRole: string | undefined,
  ): T {
    if (canManageUsers(userRole)) return dto;
    const next = { ...dto };
    delete next.role;
    delete next.password;
    return next;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Post('/')
  async create(@Body() createMemberDto: CreateMemberDto, @Req() req: { user?: { role?: string } }) {
    const dto = this.stripAccountFields(createMemberDto, req.user?.role);
    const member = await this.membersService.create(dto);
    return { member };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/')
  async findAll() {
    const members = await this.membersService.findAll();
    return { members };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/stats')
  async getStats() {
    const stats = await this.membersService.getStats();
    return { stats };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Put('/layout')
  async syncLayout(
    @Body('positions') positions: { id: string; positionX: number; positionY: number }[],
  ) {
    if (!Array.isArray(positions)) {
      throw new BadRequestException('آرایه موقعیت‌ها الزامی است');
    }
    return this.membersService.syncLayout(positions);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/mahram-check')
  async checkMahram(
    @Query('activeUserId') activeUserId: string,
    @Query('targetMemberId') targetMemberId: string,
  ) {
    if (!activeUserId || !targetMemberId) {
      throw new BadRequestException('وارد کردن شناسه کاربر فعال و کاربر هدف الزامی است');
    }
    const isMahram = await this.membersService.checkIsMahram(activeUserId, targetMemberId);
    return { isMahram };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/relationship')
  async getRelationship(
    @Query('userAId') userAId: string,
    @Query('userBId') userBId: string,
    @Query('lang') lang?: 'fa' | 'ar',
  ) {
    if (!userAId || !userBId) {
      throw new BadRequestException('وارد کردن شناسه هر دو کاربر الزامی است');
    }
    const activeLang = lang === 'ar' ? 'ar' : 'fa';
    const relationship = await this.membersService.findRelationship(userAId, userBId, activeLang);
    return { relationship };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/marriages')
  async findAllMarriages() {
    const marriages = await this.membersService.findAllMarriages();
    return { marriages };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Post('/marriages')
  async createMarriage(
    @Body('spouseA') spouseA: string,
    @Body('spouseB') spouseB: string,
    @Body('children') children?: string[],
    @Body('marriageDate') marriageDate?: string,
  ) {
    if (!spouseA || !spouseB) {
      throw new BadRequestException('شناسه همسر اول و همسر دوم الزامی است');
    }
    const marriage = await this.membersService.createMarriage(
      spouseA,
      spouseB,
      children || [],
      marriageDate ? new Date(marriageDate) : undefined,
    );
    return { marriage };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Post('/marriages/:id/children')
  async addChildToMarriage(
    @Param('id') marriageId: string,
    @Body('childId') childId: string,
  ) {
    if (!childId) {
      throw new BadRequestException('شناسه فرزند الزامی است');
    }
    const marriage = await this.membersService.addChildToMarriage(marriageId, childId);
    return { marriage };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Delete('/marriages/:id')
  async removeMarriage(@Param('id') marriageId: string) {
    return this.membersService.removeMarriage(marriageId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Post('/:id/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 30 * 1024 * 1024 } }))
  async uploadAvatar(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadAvatar(id, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Post('/:id/photos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadGalleryPhoto(id, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Post('/:id/audio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async uploadAudio(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
  ) {
    return this.uploadService.uploadAudioMemory(id, file, title || '');
  }

  @UseGuards(JwtAuthGuard)
  @Get('/:id')
  async findOne(@Param('id') id: string) {
    const member = await this.membersService.findOne(id);
    return { member };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Put('/:id')
  async update(
    @Param('id') id: string,
    @Body() editMemberDto: EditMemberDto,
    @Req() req: { user?: { role?: string } },
  ) {
    const dto = this.stripAccountFields(editMemberDto, req.user?.role);
    const member = await this.membersService.update(id, dto);
    return { member };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @Delete('/:id')
  async remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }
}
