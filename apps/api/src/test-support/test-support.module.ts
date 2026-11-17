import { Module, type DynamicModule } from '@nestjs/common';

import { TestSupportController } from './test-support.controller.js';
import { TestSupportService } from './test-support.service.js';

/**
 * Apoyo para los e2e: `GET /test/emails`, `POST /test/reset`, `POST /test/users`.
 * `forEnv()` devuelve un módulo vacío salvo con NODE_ENV=test, así que fuera de los
 * tests ni el controlador ni el servicio existen.
 */
@Module({})
export class TestSupportModule {
  static forEnv(nodeEnv: string | undefined = process.env.NODE_ENV): DynamicModule {
    if (nodeEnv !== 'test') return { module: TestSupportModule };
    return { module: TestSupportModule, controllers: [TestSupportController], providers: [TestSupportService] };
  }
}
