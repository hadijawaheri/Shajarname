import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TreePdfDto {
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1800)
  @Max(3000)
  year: number;

  @IsEnum(['fa', 'ar'])
  lang: 'fa' | 'ar';
}
