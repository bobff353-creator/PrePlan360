import "server-only";

import { loadFermilabEmployees, loadFermilabModule } from "@/db/fermilab";
import { loadStickneyEmployees, loadStickneyModule, type StickneyEmployee, type StickneyModuleData } from "@/db/stickney";

export type DepartmentSourcePresentation = {
  key: "stickney" | "fermilab";
  name: string;
  recordsLabel: string;
  recordsDescription: string;
  systemName: string;
  inventoryPhotoRoute: string;
  employeePhotoRoute: string;
};

const sources: Record<string, DepartmentSourcePresentation> = {
  stickney: {
    key: "stickney",
    name: "Stickney",
    recordsLabel: "Live Stickney records",
    recordsDescription: "Read-only connection to Stickney Firehouse Manager. Source records remain in place; authorized changes save as department overlays.",
    systemName: "Stickney Firehouse Manager",
    inventoryPhotoRoute: "stickney-inventory-photo",
    employeePhotoRoute: "stickney-photo",
  },
  fermilab: {
    key: "fermilab",
    name: "Fermilab",
    recordsLabel: "Preserved Fermilab records",
    recordsDescription: "Read-only connection to the latest complete Fermilab mirror. Original records remain unchanged; authorized changes save as department overlays.",
    systemName: "the preserved Fermilab mirror",
    inventoryPhotoRoute: "fermilab-media",
    employeePhotoRoute: "",
  },
};

export function getDepartmentSource(slug: string) {
  return sources[slug] ?? null;
}

export async function loadDepartmentSourceModule(source: DepartmentSourcePresentation, module: string, departmentId: string): Promise<StickneyModuleData> {
  return source.key === "fermilab" ? loadFermilabModule(module, departmentId) : loadStickneyModule(module, departmentId);
}

export async function loadDepartmentSourceEmployees(source: DepartmentSourcePresentation, departmentId: string): Promise<StickneyEmployee[]> {
  return source.key === "fermilab" ? loadFermilabEmployees(departmentId) : loadStickneyEmployees(departmentId);
}
