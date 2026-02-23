import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCharacterDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() personalityPrompt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() visualPrompt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() voiceId?: string;
}
