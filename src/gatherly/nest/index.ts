import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { GatherlyClient } from '../client.js';
import type { HeyAtomClientOptions } from '../../core/http.js';
import { nestLogger } from '../../nest/logger.js';
import type { ClientModuleAsyncOptions } from '../../nest/options.js';

export * from '../index.js';
export type { ClientModuleAsyncOptions } from '../../nest/options.js';
export { toHttpException } from '../../nest/errors.js';

export const GATHERLY_OPTIONS = Symbol('GATHERLY_OPTIONS');

/**
 * Provides `GatherlyClient` (the service-client surface). Global: import once in `AppModule`.
 * `auth` is a Bastion service-client token minted for `gatherly`; its tenant is the scope.
 * ```ts
 * HeyAtomGatherlyModule.forRootAsync({
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => {
 *     // ServiceTokenProvider of @heyatom/bastion-client, one per process
 *     const tokens = new ServiceTokenProvider(new BastionHttp({ baseUrl: config.getOrThrow('BASTION_URL') }), {
 *       apiKey: config.getOrThrow('BASTION_CLIENT_API_KEY'),
 *       serviceSlug: 'gatherly',
 *     });
 *     return { baseUrl: config.getOrThrow('GATHERLY_URL'), auth: serviceTokenAuth(tokens, 'gatherly') };
 *   },
 * })
 * ```
 */
@Global()
@Module({})
export class HeyAtomGatherlyModule {
  static forRoot(options: HeyAtomClientOptions): DynamicModule {
    return this.build({ provide: GATHERLY_OPTIONS, useValue: options });
  }

  static forRootAsync(options: ClientModuleAsyncOptions): DynamicModule {
    return this.build({ provide: GATHERLY_OPTIONS, useFactory: options.useFactory, inject: options.inject as never[] }, options.imports);
  }

  private static build(optionsProvider: Provider, imports: DynamicModule['imports'] = []): DynamicModule {
    return {
      module: HeyAtomGatherlyModule,
      imports,
      providers: [
        optionsProvider,
        {
          provide: GatherlyClient,
          inject: [GATHERLY_OPTIONS],
          useFactory: (o: HeyAtomClientOptions) => new GatherlyClient({ logger: nestLogger(GatherlyClient.name), ...o }),
        },
      ],
      exports: [GatherlyClient],
    };
  }
}
