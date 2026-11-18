/**
 * Constantes de dominio. Las uniones de string sustituyen en la web a los enums de Prisma
 * (docs/08-convenciones.md). Los valores deben coincidir con docs/02-modelo-datos.md.
 */

// ─── Grupos ───────────────────────────────────────────────────────────────

/** Orden de asignación del color de calle (docs/02 §Asignación de laneColor). */
export const LANE_COLOR_ORDER = [
  'CORAL',
  'SEA',
  'SUN',
  'LEAF',
  'VIOLET',
  'ROSE',
  'ORANGE',
  'SLATE',
] as const;
export type LaneColor = (typeof LANE_COLOR_ORDER)[number];

/** Nombre del token CSS de cada color de calle (DESIGN.md §3). */
export const LANE_COLOR_TOKEN: Record<LaneColor, string> = {
  CORAL: '--lane-coral',
  SEA: '--lane-sea',
  SUN: '--lane-sun',
  LEAF: '--lane-leaf',
  VIOLET: '--lane-violet',
  ROSE: '--lane-rose',
  ORANGE: '--lane-orange',
  SLATE: '--lane-slate',
};

export const INVITE_TTL_DAYS = 10;
export const MAX_GROUP_MEMBERS = 20;
/** Invitaciones `ACTIVE` como mucho por grupo (spec 02, RN-02-12). */
export const MAX_ACTIVE_INVITES_PER_GROUP = 20;
/** Invitaciones que puede crear un usuario al día (throttler, RN-02-12). */
export const MAX_INVITES_PER_USER_PER_DAY = 20;

// ─── Compra ───────────────────────────────────────────────────────────────

export const AISLES = [
  'FRUITS_VEGETABLES',
  'MEAT',
  'FISH',
  'DAIRY_EGGS',
  'BAKERY',
  'PANTRY',
  'FROZEN',
  'DRINKS',
  'SNACKS',
  'CLEANING',
  'HYGIENE',
  'BABY',
  'PETS',
  'OTHER',
] as const;
export type Aisle = (typeof AISLES)[number];

export const AISLE_LABELS: Record<Aisle, string> = {
  FRUITS_VEGETABLES: 'Frutas y verduras',
  MEAT: 'Carne',
  FISH: 'Pescado',
  DAIRY_EGGS: 'Lácteos y huevos',
  BAKERY: 'Panadería',
  PANTRY: 'Despensa',
  FROZEN: 'Congelados',
  DRINKS: 'Bebidas',
  SNACKS: 'Aperitivos y dulces',
  CLEANING: 'Limpieza',
  HYGIENE: 'Higiene',
  BABY: 'Bebé',
  PETS: 'Mascotas',
  OTHER: 'Otros',
};

/** Unidades de la lista de la compra (docs/02, comentario de ShoppingItem.unit). */
export const UNITS = [
  'ud',
  'kg',
  'g',
  'l',
  'ml',
  'paquete',
  'lata',
  'botella',
  'docena',
  'bolsa',
] as const;
export type Unit = (typeof UNITS)[number];

// ─── Comidas y dieta ──────────────────────────────────────────────────────

export const MEAL_SLOTS = ['BREAKFAST', 'MID_MORNING', 'LUNCH', 'SNACK', 'DINNER'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  BREAKFAST: 'Desayuno',
  MID_MORNING: 'Media mañana',
  LUNCH: 'Comida',
  SNACK: 'Merienda',
  DINNER: 'Cena',
};

/** 14 alérgenos de declaración obligatoria en la UE (Reglamento 1169/2011). */
export const ALLERGENS = [
  'GLUTEN',
  'CRUSTACEANS',
  'EGGS',
  'FISH',
  'PEANUTS',
  'SOY',
  'MILK',
  'TREE_NUTS',
  'CELERY',
  'MUSTARD',
  'SESAME',
  'SULPHITES',
  'LUPIN',
  'MOLLUSCS',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  GLUTEN: 'Gluten',
  CRUSTACEANS: 'Crustáceos',
  EGGS: 'Huevo',
  FISH: 'Pescado',
  PEANUTS: 'Cacahuetes',
  SOY: 'Soja',
  MILK: 'Leche',
  TREE_NUTS: 'Frutos de cáscara',
  CELERY: 'Apio',
  MUSTARD: 'Mostaza',
  SESAME: 'Sésamo',
  SULPHITES: 'Sulfitos',
  LUPIN: 'Altramuces',
  MOLLUSCS: 'Moluscos',
};

export const DIETS = ['OMNIVORE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN'] as const;
export type Diet = (typeof DIETS)[number];

export const DIET_LABELS: Record<Diet, string> = {
  OMNIVORE: 'Omnívora',
  VEGETARIAN: 'Vegetariana',
  VEGAN: 'Vegana',
  PESCATARIAN: 'Pescetariana',
};

// ─── Gastos ───────────────────────────────────────────────────────────────

/** Categorías que se crean con cada grupo (docs/02, ExpenseCategory). */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Restaurantes', emoji: '🍽️' },
  { name: 'Ocio', emoji: '🎟️' },
  { name: 'Viajes', emoji: '✈️' },
  { name: 'Ropa', emoji: '👕' },
  { name: 'Suscripciones', emoji: '📺' },
  { name: 'Deporte', emoji: '🏃' },
  { name: 'Regalos', emoji: '🎁' },
  { name: 'Caprichos', emoji: '🍫' },
  { name: 'Otros', emoji: '📦' },
] as const;
