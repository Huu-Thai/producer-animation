import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() globalContext?: Record<string, any>;
  @ApiProperty({ required: false }) @IsOptional() @IsString() memorySummary?: string;
}
