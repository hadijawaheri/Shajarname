// Validation
import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsNumber,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Helpers
import { convertAPToEnglish } from 'src/helpers/convert-ap-to-english';

export class EditMemberDto {
  @IsOptional()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString({ message: 'نام باید از نوع رشته باشد' })
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString({ message: 'نام خانوادگی باید از نوع رشته باشد' })
  @MaxLength(160)
  lastName?: string;

  // Mobile: normalize Arabic/Persian digits before validation
  @IsOptional()
  @Transform(({ value }): unknown => {
    const input = value as unknown;
    return typeof input === 'string' ? convertAPToEnglish(input) : input;
  })
  @IsString({ message: 'تلفن همراه باید از نوع رشته باشد' })
  @MaxLength(32)
  mobile?: string;

  @IsOptional()
  @IsEnum(['male', 'female'], { message: 'جنسیت باید male یا female باشد' })
  gender?: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاریخ تولد باید یک تاریخ معتبر باشد' })
  birthday?: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاریخ فوت باید یک تاریخ معتبر باشد' })
  deathday?: string;

  @IsOptional()
  @IsString({ message: 'بیوگرافی باید از نوع رشته باشد' })
  @MaxLength(5000)
  biography?: string;

  @IsOptional()
  @IsEnum(['fa', 'ar'], { message: 'زبان باید fa یا ar باشد' })
  language?: string;

  @IsOptional()
  @IsString({ message: 'نام کاربری باید از نوع رشته باشد' })
  @MaxLength(100)
  username?: string;

  @IsOptional()
  @IsString({ message: 'کلمه عبور باید از نوع رشته باشد' })
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsEnum(['admin', 'editor', 'member'], {
    message: 'نقش باید admin، editor یا member باشد',
  })
  role?: string;

  @IsOptional()
  @IsNumber({}, { message: 'موقعیت X باید عدد باشد' })
  positionX?: number;

  @IsOptional()
  @IsNumber({}, { message: 'موقعیت Y باید عدد باشد' })
  positionY?: number;

  @IsOptional()
  @IsBoolean({ message: 'وضعیت روی بوم باید از نوع بولین باشد' })
  isOnCanvas?: boolean;

  // Frontend tree linkage
  @IsOptional()
  @IsString({ message: 'شناسه ازدواج والدین باید از نوع رشته باشد' })
  parentMarriageId?: string;

  @IsOptional()
  @IsString({ message: 'مسیر آواتار باید از نوع رشته باشد' })
  @MaxLength(2048)
  avatar?: string;

  @IsOptional()
  @IsBoolean({ message: 'وضعیت حریم خصوصی باید از نوع بولین باشد' })
  privacyProtected?: boolean;
}
