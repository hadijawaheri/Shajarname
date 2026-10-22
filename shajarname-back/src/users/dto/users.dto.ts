import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SetUserRoleDto {
  @IsEnum(['admin', 'editor', 'member'], {
    message: 'نقش باید admin، editor یا member باشد',
  })
  role!: 'admin' | 'editor' | 'member';
}

export class ResetUserPasswordDto {
  @IsString({ message: 'رمز عبور الزامی است' })
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد' })
  @MaxLength(128)
  password!: string;
}

export class GrantLoginDto {
  @IsOptional()
  @IsString({ message: 'شماره موبایل باید رشته باشد' })
  @MaxLength(32)
  mobile?: string;

  @IsString({ message: 'رمز عبور الزامی است' })
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد' })
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsEnum(['admin', 'editor', 'member'], {
    message: 'نقش باید admin، editor یا member باشد',
  })
  role?: 'admin' | 'editor' | 'member';
}
