import type {
  ActivityDto,
  GroupMemberDto,
  LaneDto,
  DashboardDto,
} from '@hogaria/shared';

/** Contexto del día que reciben todos los providers (spec 15 §5). */
export interface DashboardContext {
  groupId: string;
  userId: string;
  /** `YYYY-MM-DD` en la zona del grupo. */
  date: string;
  /** `[dayStartUtc, dayEndUtc)`: 23 o 25 horas los días de cambio de hora. */
  dayStartUtc: Date;
  dayEndUtc: Date;
  timezone: string;
}

/** Sub-secciones de una calle: mapa por `userId` (`null` = "Sin asignar", solo en tareas). */
export type LaneSectionMap<T> = Map<string | null, T>;

/** Lo que devuelve el provider de cada clave. */
export interface DashboardSectionResults {
  members: GroupMemberDto[];
  activity: ActivityDto[];
  shifts: LaneSectionMap<NonNullable<LaneDto['shift']>>;
  tasks: LaneSectionMap<NonNullable<LaneDto['tasks']>>;
  events: LaneSectionMap<NonNullable<LaneDto['events']>>;
  meals: NonNullable<DashboardDto['meals']>;
  bills: NonNullable<DashboardDto['bills']>;
  shopping: NonNullable<DashboardDto['shopping']>;
}

export type DashboardSectionKey = keyof DashboardSectionResults;

/**
 * Una sección del Inicio (RN-15-20). Cada módulo registra la suya en `DASHBOARD_SECTIONS`
 * y lee sus datos a través de **su propio servicio** (no Prisma directo para datos ajenos).
 * Si una clave opcional no tiene provider, no aparece en la respuesta.
 */
export interface DashboardSectionProvider<K extends DashboardSectionKey = DashboardSectionKey> {
  key: K;
  load(ctx: DashboardContext): Promise<DashboardSectionResults[K]>;
}

/**
 * Token multi-provider. Para añadir una sección: crear su provider en el módulo dueño,
 * exportarlo, importar ese módulo en `DashboardModule` y añadir la clase a `inject` del factory.
 */
export const DASHBOARD_SECTIONS = Symbol('DASHBOARD_SECTIONS');
