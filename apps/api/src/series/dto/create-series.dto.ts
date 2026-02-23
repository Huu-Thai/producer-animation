import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSeriesDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() genre?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() artStyle?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['vi', 'en']) defaultLanguage?: string;
}

export class UpdateSeriesDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() genre?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() artStyle?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['vi', 'en']) defaultLanguage?: string;
}
