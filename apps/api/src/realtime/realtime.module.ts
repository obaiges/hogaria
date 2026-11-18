import { Global, Module } from '@nestjs/common';

import { RealtimeRooms } from './realtime-rooms.service.js';
import { RealtimeGateway } from './realtime.gateway.js';

/** Global: los servicios inyectan `RealtimeRooms` y `RealtimeGateway` sin importar el módulo. */
@Global()
@Module({
  providers: [RealtimeGateway, RealtimeRooms],
  exports: [RealtimeGateway, RealtimeRooms],
})
export class RealtimeModule {}
