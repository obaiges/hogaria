import { Global, Module } from '@nestjs/common';

import { RealtimeRooms } from './realtime-rooms.service.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimePublisher } from './realtime.publisher.js';

/** Global: los servicios inyectan `RealtimePublisher`, `RealtimeRooms` y `RealtimeGateway` sin importar el módulo. */
@Global()
@Module({
  providers: [RealtimeGateway, RealtimeRooms, RealtimePublisher],
  exports: [RealtimeGateway, RealtimeRooms, RealtimePublisher],
})
export class RealtimeModule {}
