import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member, MemberDocument } from 'src/members/schemas';
import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from './jwt-secret';

export interface JwtPayload {
  sub: string;
  mobile: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(configService),
    });
  }

  async validate(payload: JwtPayload) {
    const member = await this.memberModel.findOne({
      _id: payload.sub,
      deleted: false,
    });
    if (!member) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    return {
      id: member._id.toString(),
      mobile: member.mobile,
      role: member.role,
      language: member.language,
    };
  }
}
