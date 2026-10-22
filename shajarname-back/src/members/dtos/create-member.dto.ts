// Validation
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString, IsBoolean, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

// Helpers
import { convertAPToEnglish } from 'src/helpers/convert-ap-to-english';

export class CreateMemberDto {
  @IsString({ message: 'نام باید از نوع رشته باشد' })
  @IsNotEmpty({ message: 'نام الزامی است' })
  name: string;

  @IsString({ message: 'نام خانوادگی باید از نوع رشته باشد' })
  @IsNotEmpty({ message: 'نام خانوادگی الزامی است' })
  lastName: string;

  // Mobile: normalize Arabic/Persian digits before validation (optional — auto-generated if omitted)
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? convertAPToEnglish(value) : value))
  @IsString({ message: 'تلفن همراه باید از نوع رشته باشد' })
  mobile?: string;

  @IsEnum(['male', 'female'], { message: 'جنسیت باید male یا female باشد' })
  @IsNotEmpty({ message: 'جنسیت الزامی است' })
  gender: string;

  @IsDateString({}, { message: 'تاریخ تولد باید یک تاریخ معتبر باشد' })
  @IsNotEmpty({ message: 'تاریخ تولد الزامی است' })
  birthday: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاریخ فوت باید یک تاریخ معتبر باشد' })
  deathday?: string;

  @IsOptional()
  @IsString({ message: 'بیوگرافی باید از نوع رشته باشد' })
  biography?: string;

  @IsOptional()
  @IsEnum(['fa', 'ar'], { message: 'زبان باید fa یا ar باشد' })
  language?: string;

  @IsOptional()
  @IsString({ message: 'نام کاربری باید از نوع رشته باشد' })
  username?: string;

  @IsOptional()
  @IsString({ message: 'کلمه عبور باید از نوع رشته باشد' })
  password?: string;

  @IsOptional()
  @IsEnum(['admin', 'editor', 'member'], { message: 'نقش باید admin، editor یا member باشد' })
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

  // Frontend tree linkage: references a MarriageNode ID
  @IsOptional()
  @IsString({ message: 'شناسه ازدواج والدین باید از نوع رشته باشد' })
  parentMarriageId?: string;

  @IsOptional()
  @IsString({ message: 'مسیر آواتار باید از نوع رشته باشد' })
  avatar?: string;

  @IsOptional()
  @IsBoolean({ message: 'وضعیت حریم خصوصی باید از نوع بولین باشد' })
  privacyProtected?: boolean;

  @IsOptional()
  @IsString({ message: 'نام انگلیسی باید از نوع رشته باشد' })
  nameEn?: string;
}
