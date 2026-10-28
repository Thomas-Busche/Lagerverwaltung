import { IsInt, IsNumber, IsOptional, IsString, IsUppercase, Length, Max, Min } from "class-validator";

export class UpdatePurchaseOrderLineDto {
  @IsInt({ message: "Menge muss eine ganze Zahl sein" })
  @Min(1, { message: "Menge muss mindestens 1 sein" })
  @Max(1000000, { message: "Menge ist zu groß" })
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitPriceNet?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  currency?: string;
}

export class AddPurchaseOrderLineDto extends UpdatePurchaseOrderLineDto {
  @IsString()
  @Length(1, 64)
  itemId!: string;
}
