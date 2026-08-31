import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class SetpointDto {
  @IsNumber()
  @Min(16)
  @Max(30)
  setpoint!: number;
}

export class VavModeDto {
  @IsIn(["auto", "manual"])
  modo!: "auto" | "manual";
}

export class VavOpeningDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  abertura!: number;
}

export class VavFaultDto {
  @IsBoolean()
  falha!: boolean;
}

export class ClimatizerPatchDto {
  @IsOptional()
  @IsBoolean()
  ligado?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-50)
  @Max(80)
  tempInsuflamento?: number;
}

export class BathroomLightDto {
  @IsBoolean()
  luz!: boolean;
}

export class DeviceVavStateDto {
  @IsString()
  salaId!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  abertura!: number;

  @IsIn(["ok", "falha"])
  estado!: "ok" | "falha";
}

export class DeviceBathroomLightDto {
  @IsString()
  banheiroId!: string;

  @IsBoolean()
  luz!: boolean;
}
