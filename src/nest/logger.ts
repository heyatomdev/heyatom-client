import { Logger } from '@nestjs/common';
import type { HeyAtomLogger } from '../core/http.js';

export function nestLogger(context: string): HeyAtomLogger {
  const logger = new Logger(context);
  return {
    warn: (m) => logger.warn(m),
    error: (m) => logger.error(m),
    log: (m) => logger.log(m),
  };
}
