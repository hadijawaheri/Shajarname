import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Member, MemberDocument } from 'src/members/schemas';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';
import { LoginDto } from './dtos/login.dto';
import { convertAPToEnglish } from 'src/helpers/convert-ap-to-english';

const ACCESS_EXPIRES_SEC = 15 * 60;
const ACCESS_EXPIRES_LABEL = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_DAYS = parseInt(process.env.JWT_REFRESH_DAYS || '30', 10);

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Member.name) private readonly memberModel: Model<MemberDocument>,
    @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly jwtService: JwtService,
  ) {}

  private toMemberDto(member: Member) {
    return {
      id: member._id.toString(),
      name: member.name,
      lastName: member.lastName,
      mobile: member.mobile,
      role: member.role,
      language: member.language,
      avatar: member.avatar,
      mustChangePassword: member.mustChangePassword ?? false,
    };
  }

  private signAccessToken(member: Member): string {
    const payload = { sub: member._id.toString(), mobile: member.mobile, role: member.role };
    return this.jwtService.sign(payload, { expiresIn: ACCESS_EXPIRES_SEC });
  }

  private async createRefreshToken(memberId: string): Promise<string> {
    const randomPart = randomBytes(32).toString('hex');
    const refreshToken = `rt.${memberId}.${randomPart}`;
    const tokenHash = await bcrypt.hash(randomPart, 10);
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

    await this.refreshTokenModel.create({
      memberId: new Types.ObjectId(memberId),
      tokenHash,
      expiresAt,
    });

    return refreshToken;
  }

  private async revokeRefreshToken(refreshToken: string): Promise<string | null> {
    const parts = refreshToken.split('.');
    if (parts.length !== 3 || parts[0] !== 'rt') return null;
    const memberId = parts[1];
    const randomPart = parts[2];

    const tokens = await this.refreshTokenModel.find({
      memberId: new Types.ObjectId(memberId),
      expiresAt: { $gt: new Date() },
    });

    for (const stored of tokens) {
      if (await bcrypt.compare(randomPart, stored.tokenHash)) {
        await stored.deleteOne();
        return memberId;
      }
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const mobile = convertAPToEnglish(loginDto.mobile);
    const member = await this.memberModel
      .findOne({
        $or: [{ mobile }, { username: mobile }],
        deleted: false,
      })
      .select('+passwordHash');
    if (!member || !member.passwordHash) {
      throw new UnauthorizedException('موبایل یا رمز عبور اشتباه است');
    }

    const normalizedPw = convertAPToEnglish(loginDto.password);
    const valid =
      (await bcrypt.compare(loginDto.password, member.passwordHash)) ||
      (await bcrypt.compare(normalizedPw, member.passwordHash));
    if (!valid) {
      throw new UnauthorizedException('موبایل یا رمز عبور اشتباه است');
    }

    const accessToken = this.signAccessToken(member);
    const refreshToken = await this.createRefreshToken(member._id.toString());

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_EXPIRES_LABEL,
      member: this.toMemberDto(member),
    };
  }

  async refresh(refreshToken: string) {
    const memberId = await this.revokeRefreshToken(refreshToken);
    if (!memberId) {
      throw new UnauthorizedException('توکن نامعتبر یا منقضی شده است');
    }

    const member = await this.memberModel.findOne({ _id: memberId, deleted: false });
    if (!member) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }

    const accessToken = this.signAccessToken(member);
    const newRefreshToken = await this.createRefreshToken(memberId);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_EXPIRES_LABEL,
      member: this.toMemberDto(member),
    };
  }

  async logout(refreshToken: string) {
    await this.revokeRefreshToken(refreshToken);
    return { success: true };
  }

  async getProfile(userId: string) {
    const member = await this.memberModel.findOne({ _id: userId, deleted: false });
    if (!member) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    return this.toMemberDto(member);
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const member = await this.memberModel
      .findOne({ _id: userId, deleted: false })
      .select('+passwordHash');
    if (!member) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    if (!member.passwordHash) {
      throw new UnauthorizedException('حساب کاربری رمز عبور ندارد');
    }
    const normalizedCurrent = convertAPToEnglish(currentPassword);
    const valid =
      (await bcrypt.compare(currentPassword, member.passwordHash)) ||
      (await bcrypt.compare(normalizedCurrent, member.passwordHash));
    if (!valid) {
      throw new UnauthorizedException('رمز عبور فعلی اشتباه است');
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await this.memberModel.updateOne(
      { _id: userId },
      { $set: { passwordHash: newHash, mustChangePassword: false } },
    );
    return { success: true };
  }
}
