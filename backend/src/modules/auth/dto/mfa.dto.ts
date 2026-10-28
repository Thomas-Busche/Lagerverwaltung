import { IsNotEmpty, IsString, Length, MaxLength } from "class-validator";

export class MfaVerifyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  mfaToken!: string;

  @IsString()
  @Length(6, 8)
  totpCode!: string;
}

export class MfaTotpCodeDto {
  @IsString()
  @Length(6, 8)
  totpCode!: string;
}

export class MfaSetupTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  mfaSetupToken!: string;
}

export class MfaSetupVerifyDto extends MfaSetupTokenDto {
  @IsString()
  @Length(6, 8)
  totpCode!: string;
}

export class MfaDisableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}
