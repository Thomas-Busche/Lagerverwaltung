import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

// branchId is deliberately not updatable: moving a vehicle between branches would break stock isolation.
export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  licensePlate?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  description?: string;
}
