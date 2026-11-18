import type { Prisma } from '@prisma/client';

/**
 * Bloquea la fila del grupo hasta el final de la transacción (`SELECT … FOR UPDATE`,
 * spec 02 RN-02-08). Serializa las operaciones que leen y escriben el estado del grupo
 * (colores de calle, altas, ediciones). Devuelve `false` si el grupo no existe.
 * Tagged template de Prisma: el id va como parámetro, nunca concatenado.
 */
export async function lockGroup(tx: Prisma.TransactionClient, groupId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM groups WHERE id = ${groupId}::uuid FOR UPDATE`;
  return rows.length > 0;
}
