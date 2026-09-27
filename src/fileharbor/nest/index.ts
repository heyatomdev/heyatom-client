import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { FileHarborClient } from '../client.js';
import type { HeyAtomClientOptions } from '../../core/http.js';
import { nestLogger } from '../../nest/logger.js';
import type { ClientModuleAsyncOptions } from '../../nest/options.js';

export * from '../index.js';
export type { ClientModuleAsyncOptions } from '../../nest/options.js';

export const FILEHARBOR_OPTIONS = Symbol('FILEHARBOR_OPTIONS');

/**
 * Provides `FileHarborClient` (the API-key surface). Global: import once in `AppModule`.
 * ```ts
 * HeyAtomFileHarborModule.forRootAsync({
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     baseUrl: config.getOrThrow('FILEHARBOR_URL'),
 *     auth: apiKeyAuth(config.getOrThrow('FILEHARBOR_API_KEY')),
 *   }),
 * })
 * ```
 */
@Global()
@Module({})
export class HeyAtomFileHarborModule {
  static forRoot(options: HeyAtomClientOptions): DynamicModule {
    return this.build({ provide: FILEHARBOR_OPTIONS, useValue: options });
  }

  static forRootAsync(options: ClientModuleAsyncOptions): DynamicModule {
    return this.build({ provide: FILEHARBOR_OPTIONS, useFactory: options.useFactory, inject: options.inject as never[] }, options.imports);
  }

  private static build(optionsProvider: Provider, imports: DynamicModule['imports'] = []): DynamicModule {
    return {
      module: HeyAtomFileHarborModule,
      imports,
      providers: [
        optionsProvider,
        {
          provide: FileHarborClient,
          inject: [FILEHARBOR_OPTIONS],
          useFactory: (o: HeyAtomClientOptions) => new FileHarborClient({ logger: nestLogger(FileHarborClient.name), ...o }),
        },
      ],
      exports: [FileHarborClient],
    };
  }
}
