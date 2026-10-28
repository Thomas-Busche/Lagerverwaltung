import { ForbiddenException, NotFoundException } from "@nestjs/common";

import type { VehiclesService } from "../vehicles/vehicles.service";

interface VehicleAccessUser {
  role?: string;
  branchId: string | null;
  vehicleId: string | null;
}

/**
 * Guards the vehicle-scoped stock routes. A foreign-branch vehicle is reported as
 * missing (no existence leak); technicians are limited to their assigned vehicle.
 */
export async function assertVehicleAccess(
  vehiclesService: Pick<VehiclesService, "findOne">,
  user: VehicleAccessUser | undefined,
  vehicleId: string,
): Promise<void> {
  if (!user) {
    throw new ForbiddenException("Kein Zugriff auf dieses Fahrzeug");
  }
  const vehicle = await vehiclesService.findOne(vehicleId, user.branchId);
  if (!vehicle) {
    throw new NotFoundException("Fahrzeug nicht gefunden");
  }
  if (user.role === "TECHNICIAN" && user.vehicleId !== vehicleId) {
    throw new ForbiddenException("Kein Zugriff auf dieses Fahrzeug");
  }
}
