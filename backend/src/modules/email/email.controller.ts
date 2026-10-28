import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LogCategory } from '../logging/entities/system-log.entity';
import { LoggingService } from '../logging/services/logging.service';

import { EmailConfigDto, PasswordResetRequestDto, TestEmailDto } from './dto/email.dto';
import { EmailService } from './email.service';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly loggingService: LoggingService,
  ) {}

  @Get('config')
  @Roles('MANAGER')
  async getEmailConfig(@Req() req: Request) {
    const branchId = req.user?.branchId ?? null;
    const config = await this.emailService.getConfiguration(branchId);
    const isConfigured = await this.emailService.isConfigured(branchId);
    return { isConfigured, config: config || {} };
  }

  @Post('config')
  @Roles('MANAGER')
  async setEmailConfig(@Body() config: EmailConfigDto, @Req() req: Request) {
    const branchId = req.user?.branchId ?? null;

    try {
      await this.emailService.configureTransport(config, branchId);

      if (req.user) {
        await this.loggingService.logSecurity(
          'EMAIL_CONFIG_UPDATED',
          `Email-Konfiguration aktualisiert von ${req.user.username}${branchId ? '' : ' (global)'}`,
          {
            userId: req.user.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: { host: config.host, port: config.port, user: config.auth.user, from: config.from, branchId },
          },
        );
      }

      return { success: true, message: 'Email-Konfiguration gespeichert' };
    } catch (error) {
      throw new BadRequestException(
        `Konfiguration fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      );
    }
  }

  @Post('test')
  @Roles('MANAGER')
  async sendTestEmail(@Body() body: TestEmailDto, @Req() req: Request) {
    const branchId = req.user?.branchId ?? null;

    try {
      await this.emailService.sendTestEmail(body.email, branchId);

      if (req.user) {
        await this.loggingService.logInfo(
          LogCategory.SYSTEM,
          'EMAIL_TEST_SENT',
          `Test-Email gesendet an ${body.email} von ${req.user.username}`,
          { userId: req.user.id, metadata: { recipient: body.email } },
        );
      }

      return { success: true, message: `Test-Email an ${body.email} gesendet` };
    } catch (error) {
      throw new BadRequestException(
        `Test-Email fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      );
    }
  }

  @Post('password-reset')
  requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    return {
      success: true,
      message: 'Falls der Benutzer existiert, wurde eine Passwort-Reset Email gesendet',
    };
  }
}
