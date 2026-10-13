import { Module } from '@nestjs/common';
import { SearchResolver } from './search.resolver.js';

@Module({
  providers: [SearchResolver],
})
export class SearchModule {}
