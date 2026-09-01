import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class NtfyConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsUrl({ require_tld: false })
  server?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  topic?: string;

  @IsOptional()
  @IsIn(["atencao", "critico"])
  minLevel?: "atencao" | "critico";
}

export class IdentificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  estabelecimento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cnes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sistema?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsavelTecnico?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  registro?: string;
}
