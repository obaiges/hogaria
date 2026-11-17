import { Test, type TestingModule, type TestingModuleBuilder } from '@nestjs/testing';

import { GEMINI_CLIENT } from '../../src/ai/gemini-client.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { EMAIL_SENDER } from '../../src/email/email-sender.js';
import { PUSH_SENDER } from '../../src/push/push-sender.js';

import type { FakeGeminiClient } from '../../src/ai/fake-gemini.client.js';
import type { FakeEmailSender } from '../../src/email/fake-email-sender.js';
import type { FakeWebPushSender } from '../../src/push/fake-push-sender.js';
import type { DynamicModule, ForwardReference, INestApplication, InjectionToken, Type } from '@nestjs/common';

type ModuleImport = Type | DynamicModule | ForwardReference;

export interface TestAppOptions {
  /** Módulos extra (p. ej. un controlador de prueba) que se importan junto a `AppModule`. */
  imports?: ModuleImport[];
  /** Proveedores sustituidos por un valor: `[{ provide: PrismaService, useValue: mock }]`. */
  overrides?: { provide: InjectionToken; useValue: unknown }[];
  /** Ajustes extra del módulo de pruebas antes de compilar. */
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

export interface TestApp {
  app: INestApplication;
  moduleRef: TestingModule;
  /** Atajo para supertest: `request(t.server)`. */
  server: ReturnType<INestApplication['getHttpServer']>;
  emails: FakeEmailSender;
  push: FakeWebPushSender;
  gemini: FakeGeminiClient;
  close: () => Promise<void>;
}

/**
 * Arranca la API completa (`AppModule` + `configureApp`, igual que `main.ts`) con
 * `NODE_ENV=test`, así que email, push y Gemini son los *fakes*. Cualquier proveedor
 * se puede sustituir con `overrides`.
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  let builder = Test.createTestingModule({ imports: [AppModule, ...(options.imports ?? [])] });
  for (const o of options.overrides ?? []) {
    builder = builder.overrideProvider(o.provide).useValue(o.useValue);
  }
  if (options.configure) builder = options.configure(builder);

  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication({ bodyParser: false, logger: false }));
  await app.init();

  return {
    app,
    moduleRef,
    server: app.getHttpServer(),
    emails: app.get<FakeEmailSender>(EMAIL_SENDER),
    push: app.get<FakeWebPushSender>(PUSH_SENDER),
    gemini: app.get<FakeGeminiClient>(GEMINI_CLIENT),
    close: () => app.close(),
  };
}
