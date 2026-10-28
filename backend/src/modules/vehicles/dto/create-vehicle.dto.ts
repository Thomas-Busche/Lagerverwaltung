import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

// Lengths mirror the Vehicle entity columns.
export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  licensePlate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  description!: string;

  // Only honoured for super-admins (no branch in token); ignored for everyone else.
  @IsOptional()
  @IsString()
  branchId?: string;
}
