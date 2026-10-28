import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class EmailAuthDto {
  @IsEmail({}, { message: 'Ungültige Email-Adresse' })
  @MaxLength(254)
  user!: string;

  @IsString()
  @IsNotEmpty({ message: 'Alle Felder sind erforderlich' })
  @MaxLength(256)
  pass!: string;
}

export class EmailConfigDto {
  @IsString()
  @IsNotEmpty({ message: 'Alle Felder sind erforderlich' })
  @MaxLength(255)
  host!: string;

  @IsInt({ message: 'Port muss zwischen 1 und 65535 liegen' })
  @Min(1, { message: 'Port muss zwischen 1 und 65535 liegen' })
  @Max(65535, { message: 'Port muss zwischen 1 und 65535 liegen' })
  port!: number;

  @IsBoolean()
  secure!: boolean;

  @ValidateNested()
  @Type(() => EmailAuthDto)
  auth!: EmailAuthDto;

  @IsEmail({}, { message: 'Ungültige Email-Adresse' })
  @MaxLength(254)
  from!: string;
}

export class TestEmailDto {
  @IsEmail({}, { message: 'Gültige Email-Adresse erforderlich' })
  @MaxLength(254)
  email!: string;
}

export class PasswordResetRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Benutzername erforderlich' })
  @MaxLength(100)
  username!: string;
}
