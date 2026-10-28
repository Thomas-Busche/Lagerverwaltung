import { IsInt, Max, Min } from "class-validator";

export class MovementRetentionDto {
  @IsInt({ message: "Aufbewahrungsdauer muss eine ganze Zahl sein." })
  @Min(365, { message: "Aufbewahrungsdauer muss zwischen 365 und 36500 Tagen liegen." })
  @Max(36500, { message: "Aufbewahrungsdauer muss zwischen 365 und 36500 Tagen liegen." })
  retentionDays!: number;
}

export class MovementCleanupDto {
  @IsInt({ message: "days muss eine ganze Zahl sein." })
  @Min(365, { message: "days muss >= 365 sein." })
  @Max(36500, { message: "days darf höchstens 36500 sein." })
  days!: number;
}
