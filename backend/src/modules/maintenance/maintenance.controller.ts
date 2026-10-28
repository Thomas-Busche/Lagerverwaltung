import {
  Controller, Get, Post, Put, Body, Query,
  UseGuards, Request, ForbiddenException, BadRequestException,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { assertSuperAdmin } from "../users/utils/user-access.util";

import { MovementCleanupDto, MovementRetentionDto } from "./dto/maintenance.dto";
import { MaintenanceService } from "./maintenance.service";

@Controller("maintenance")
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  private requireManager(req: ExpressRequest) {
    if (req.user?.role !== "MANAGER") {
      throw new ForbiddenException("Nur Administratoren können die Wartung ausführen.");
    }
  }

  private requireSuperAdmin(req: ExpressRequest) {
    assertSuperAdmin(req.user);
  }

  @Get("check")
  async check(@Request() req: ExpressRequest) {
    this.requireManager(req);
    return this.maintenanceService.checkIssues();
  }

  @Post("fix")
  async fix(@Request() req: ExpressRequest) {
    // System-wide data repair, not limited to one branch
    this.requireSuperAdmin(req);
    return this.maintenanceService.fixIssues();
  }

  // ─── Datenbank-Statistiken ─────────────────────────────────────────────────

  @Get("db-stats")
  async getDbStats(@Request() req: ExpressRequest) {
    this.requireSuperAdmin(req);
    return this.maintenanceService.getDbStats();
  }

  // ─── Bewegungs-Retention ───────────────────────────────────────────────────

  @Get("movement-retention")
  async getMovementRetention(@Request() req: ExpressRequest) {
    this.requireSuperAdmin(req);
    const days = await this.maintenanceService.getMovementRetentionDays();
    return { retentionDays: days };
  }

  @Put("movement-retention")
  async setMovementRetention(@Body() body: MovementRetentionDto, @Request() req: ExpressRequest) {
    this.requireSuperAdmin(req);
    const days = body.retentionDays;
    await this.maintenanceService.setMovementRetentionDays(days);
    return { success: true, retentionDays: days };
  }

  @Get("movement-cleanup/preview")
  async previewMovementCleanup(@Query("days") days: string, @Request() req: ExpressRequest) {
    this.requireSuperAdmin(req);
    const daysNum = Number(days);
    if (!daysNum || isNaN(daysNum) || daysNum < 365) {
      throw new BadRequestException("days muss >= 365 sein.");
    }
    return this.maintenanceService.previewMovementCleanup(daysNum);
  }

  @Post("movement-cleanup")
  async runMovementCleanup(@Body() body: MovementCleanupDto, @Request() req: ExpressRequest) {
    this.requireSuperAdmin(req);
    const days = body.days;
    return this.maintenanceService.deleteOldMovements(days);
  }
}
