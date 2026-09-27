import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ArticunoClient } from '../client.js';
import type { HeyAtomClientOptions } from '../../core/http.js';
import { nestLogger } from '../../nest/logger.js';
import type { ClientModuleAsyncOptions } from '../../nest/options.js';

export * from '../index.js';
export type { ClientModuleAsyncOptions } from '../../nest/options.js';

export const ARTICUNO_OPTIONS = Symbol('ARTICUNO_OPTIONS');

/**
 * Provides `ArticunoClient` (the public surface). Global: import once in `AppModule`.
 * `auth` is the tenant scope: a tenant key, or a Bastion service-client token.
 * ```ts
 * HeyAtomArticunoModule.forRootAsync({
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     baseUrl: config.getOrThrow('ARTICUNO_URL'),
 *     auth: apiKeyAuth(config.getOrThrow('ARTICUNO_TENANT_API_KEY')),
 *     // or: auth: serviceTokenAuth(serviceTokenProvider, 'articuno'),
 *   }),
 * })
 * ```
 */
@Global()
@Module({})
export class HeyAtomArticunoModule {
  static forRoot(options: HeyAtomClientOptions): DynamicModule {
    return this.build({ provide: ARTICUNO_OPTIONS, useValue: options });
  }

  static forRootAsync(options: ClientModuleAsyncOptions): DynamicModule {
    return this.build({ provide: ARTICUNO_OPTIONS, useFactory: options.useFactory, inject: options.inject as never[] }, options.imports);
  }

  private static build(optionsProvider: Provider, imports: DynamicModule['imports'] = []): DynamicModule {
    return {
      module: HeyAtomArticunoModule,
      imports,
      providers: [
        optionsProvider,
        {
          provide: ArticunoClient,
          inject: [ARTICUNO_OPTIONS],
          useFactory: (o: HeyAtomClientOptions) => new ArticunoClient({ logger: nestLogger(ArticunoClient.name), ...o }),
        },
      ],
      exports: [ArticunoClient],
    };
  }
}
