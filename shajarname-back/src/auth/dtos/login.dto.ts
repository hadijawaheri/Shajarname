import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { convertAPToEnglish } from 'src/helpers/convert-ap-to-english';

export class LoginDto {
  @Transform(({ value }): unknown => {
    const input = value as unknown;
    return typeof input === 'string' ? convertAPToEnglish(input) : input;
  })
  @IsString({ message: 'موبایل باید رشته باشد' })
  @IsNotEmpty({ message: 'موبایل الزامی است' })
  @MaxLength(32)
  mobile: string;

  @IsString({ message: 'رمز عبور باید رشته باشد' })
  @IsNotEmpty({ message: 'رمز عبور الزامی است' })
  @MaxLength(128)
  password: string;
}
