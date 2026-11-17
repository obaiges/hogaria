import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { OpenApiService } from './openapi.service.js';

@Module({
  imports: [DiscoveryModule],
  providers: [OpenApiService],
  exports: [OpenApiService],
})
export class OpenApiModule {}
