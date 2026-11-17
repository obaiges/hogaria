-- La migración 0001 se guardó con el valor por defecto del emoji en doble UTF-8.
ALTER TABLE "groups" ALTER COLUMN "emoji" SET DEFAULT '🏠';
