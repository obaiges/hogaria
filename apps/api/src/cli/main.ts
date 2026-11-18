/**
 * CLI de administración de la API (docs/01 §cli).
 *
 *   pnpm --filter api cli create-owner --email <email> --username <username> [--name <nombre>]
 *   docker compose exec api node dist/cli/main.js create-owner …   (producción)
 *
 * La contraseña se lee de `OWNER_PASSWORD` o se pide dos veces por consola sin eco.
 */
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

import { CliError, createOwner } from './create-owner.command.js';

// Una CLI escribe en stdout/stderr, no en el logger de Nest.
const print = (text: string) => process.stdout.write(`${text}
`);
const printError = (text: string) => process.stderr.write(`${text}
`);

const USAGE = `Uso:
  create-owner --email <email> --username <username> [--name <nombre>]

La contraseña se lee de OWNER_PASSWORD o se pide por consola.`;

/** Lee una línea de la terminal sin mostrar lo que se escribe. */
export function promptHidden(question: string, input: NodeJS.ReadStream = process.stdin, output: NodeJS.WriteStream = process.stdout): Promise<string> {
  if (!input.isTTY) {
    return Promise.reject(new CliError('No hay terminal para pedir la contraseña: define OWNER_PASSWORD'));
  }
  return new Promise((resolve, reject) => {
    let value = '';
    output.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    const done = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.off('data', onData);
      output.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') return done();
        if (char === '\u0003') return done(new CliError('Cancelado'));
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on('data', onData);
  });
}

async function readOwnerPassword(): Promise<string> {
  const fromEnv = process.env.OWNER_PASSWORD;
  if (fromEnv) return fromEnv;
  const first = await promptHidden('Contraseña: ');
  const second = await promptHidden('Repite la contraseña: ');
  if (first !== second) throw new CliError('Las contraseñas no coinciden');
  return first;
}

async function runCreateOwner(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { email: { type: 'string' }, username: { type: 'string' }, name: { type: 'string' } },
    strict: true,
  });
  if (!values.email || !values.username) throw new CliError(`Faltan --email o --username.\n\n${USAGE}`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new CliError('DATABASE_URL es obligatoria');

  const password = await readOwnerPassword();
  const pool = new pg.Pool({ connectionString, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const user = await createOwner(prisma, { email: values.email, username: values.username, name: values.name, password });
    print(`Administrador creado: ${user.username} <${user.email}> (id ${user.id}). Ya puede entrar y crear su hogar en /grupos.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  'create-owner': runCreateOwner,
};

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const run = command ? COMMANDS[command] : undefined;
  if (!run) {
    printError(command ? `Comando desconocido: ${command}\n\n${USAGE}` : USAGE);
    return 1;
  }
  try {
    await run(rest);
    return 0;
  } catch (error) {
    if (error instanceof CliError) printError(`Error: ${error.message}`);
    else if (error instanceof TypeError && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS')) {
      printError(`Error: ${error.message}\n\n${USAGE}`);
    } else printError(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return 1;
  }
}

// En local, `.env` de apps/api (en el contenedor, las variables ya vienen de compose).
if (existsSync('.env')) process.loadEnvFile('.env');
process.exitCode = await main(process.argv.slice(2));
