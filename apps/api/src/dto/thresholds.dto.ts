import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";

export class TemperatureThresholdDto {
  @IsNumber()
  @Min(0)
  @Max(80)
  min!: number;

  @IsNumber()
  @Min(0)
  @Max(80)
  max!: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class HumidityThresholdDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  min!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  max!: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class Co2ThresholdDto {
  @IsNumber()
  @Min(0)
  @Max(100000)
  warn!: number;

  @IsNumber()
  @Min(0)
  @Max(100000)
  critical!: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class SaveThresholdsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TemperatureThresholdDto)
  temperatura?: TemperatureThresholdDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HumidityThresholdDto)
  umidade?: HumidityThresholdDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => Co2ThresholdDto)
  co2?: Co2ThresholdDto;
}
