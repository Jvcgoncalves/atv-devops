import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class TelemetryDto {
  @IsString()
  salaId!: string;

  @IsOptional()
  @IsNumber()
  @Min(-50)
  @Max(80)
  temperatura?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  umidade?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  co2?: number;
}

export class MetricParamDto {
  @IsString()
  metrica!: string;
}

export class FonteExternaDto {
  @IsOptional()
  @IsString()
  salaId!: string | null;
}
