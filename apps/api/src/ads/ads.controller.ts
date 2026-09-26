import { Controller, Get, Inject, Query } from '@nestjs/common';
import { AdSlotCode, Slug } from '@hb/types';
import { z } from 'zod';
import { parse } from '../common/validate';
import { AdsService } from './ads.service';

const ServeQuery = z.object({ slot: AdSlotCode, category: Slug.optional() }).strict();

@Controller()
export class AdsController {
  constructor(@Inject(AdsService) private readonly ads: AdsService) {}

  @Get('ads/packages')
  packages() {
    return this.ads.packages();
  }

  @Get('ads/serve')
  serve(@Query() raw: Record<string, unknown>) {
    const q = parse(ServeQuery, raw);
    return this.ads.serve(q.slot, q.category);
  }

  @Get('cms/hero-scenes')
  heroScenes() {
    return this.ads.heroScenes();
  }

  @Get('plans')
  plans() {
    return this.ads.plans();
  }
}
