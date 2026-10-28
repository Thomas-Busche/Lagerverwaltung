import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

import { LogLevel } from '../entities/system-log.entity';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SetLogLevelDto {
  @IsEnum(LogLevel, { message: 'Ungültiger Log-Level' })
  logLevel!: LogLevel;
}

export class CleanupOldLogsDto {
  @IsOptional()
  @IsInt({ message: 'daysToKeep muss eine ganze Zahl sein' })
  @Min(1, { message: 'daysToKeep muss zwischen 1 und 365 liegen' })
  @Max(365, { message: 'daysToKeep muss zwischen 1 und 365 liegen' })
  daysToKeep?: number;
}

export class LogRetentionDto {
  @IsInt({ message: 'Aufbewahrungsdauer muss eine ganze Zahl sein' })
  @Min(1, { message: 'Aufbewahrungsdauer muss zwischen 1 und 3650 Tagen liegen' })
  @Max(3650, { message: 'Aufbewahrungsdauer muss zwischen 1 und 3650 Tagen liegen' })
  retentionDays!: number;
}

export class ArchiveRetentionDto {
  @IsInt({ message: 'Archiv-Aufbewahrungsdauer muss eine ganze Zahl sein' })
  @Min(1, { message: 'Archiv-Aufbewahrungsdauer muss zwischen 1 und 36500 Tagen liegen' })
  @Max(36500, { message: 'Archiv-Aufbewahrungsdauer muss zwischen 1 und 36500 Tagen liegen' })
  retentionDays!: number;
}

export class CleanupArchivesDto {
  @IsOptional()
  @IsInt({ message: 'daysToKeep muss eine ganze Zahl sein' })
  @Min(1, { message: 'daysToKeep muss zwischen 1 und 36500 liegen' })
  @Max(36500, { message: 'daysToKeep muss zwischen 1 und 36500 liegen' })
  daysToKeep?: number;
}

export class ForceArchiveDto {
  @IsOptional()
  @Matches(ISO_DATE, { message: 'Datum muss das Format JJJJ-MM-TT haben' })
  date?: string;
}

export class ArchiveBundleDto {
  @IsArray({ message: 'Mindestens ein Datum erforderlich' })
  @ArrayMinSize(1, { message: 'Mindestens ein Datum erforderlich' })
  @ArrayMaxSize(400, { message: 'Zu viele Daten angefordert' })
  @Matches(ISO_DATE, { each: true, message: 'Datum muss das Format JJJJ-MM-TT haben' })
  dates!: string[];
}
