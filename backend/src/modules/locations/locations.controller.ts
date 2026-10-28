import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

import { CreateLocationDto } from "./dto/create-location.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { LocationsService } from "./locations.service";

@Controller("locations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @Permissions("locations.view")
  findAll(
    @Req() req: Request,
    @Query("type") type?: string,
    @Query("parentId") parentId?: string,
    @Query("includeVehicles") includeVehicles?: string,
    @Query("branchId") branchIdParam?: string,
  ) {
    // Super-Admin (branchId=null im JWT) darf branchId per Query-Param übergeben
    const branchId = req.user?.branchId !== null
      ? req.user?.branchId
      : (branchIdParam ?? null);
    return this.locationsService.findAll({
      type,
      parentId,
      includeVehicles: includeVehicles === "true",
      branchId,
      locationIds: req.user?.locationIds,
    });
  }

  @Get(":id")
  @Permissions("locations.view")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return this.locationsService.findOne(id, req.user?.branchId);
  }

  @Post()
  @Permissions("locations.create")
  create(@Body() dto: CreateLocationDto, @Req() req: Request) {
    // Super-Admin (branchId=null im JWT) muss branchId explizit im Body angeben
    if (req.user?.branchId === null && !dto.branchId) {
      throw new BadRequestException("branchId ist erforderlich, wenn kein Branch-Kontext im Token vorhanden ist (Super-Admin)");
    }
    const branchId = req.user?.branchId !== null ? req.user?.branchId : dto.branchId;
    return this.locationsService.create({ ...dto, branchId });
  }

  @Patch(":id")
  @Permissions("locations.edit")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto, req.user?.branchId);
  }

  @Delete(":id")
  @Permissions("locations.delete")
  remove(@Req() req: Request, @Param("id") id: string) {
    return this.locationsService.remove(id, req.user?.branchId);
  }
}
