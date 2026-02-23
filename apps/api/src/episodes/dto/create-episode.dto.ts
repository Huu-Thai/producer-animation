import { IsString, IsOptional, IsIn, IsInt, IsUUID, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEpisodeDto {
  @ApiProperty() @IsUUID() sessionId: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() synopsis?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['vi', 'en']) language?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() durationTarget?: number;
}

export class UpdateEpisodeDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() synopsis?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() workflow?: Record<string, any>;
}
