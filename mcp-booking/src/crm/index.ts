import { config } from '../config.js';
import { MockCrmAdapter } from './mock.js';
import { RestCrmAdapter } from './rest.js';
import { CrmAdapter } from './types.js';

let cached: CrmAdapter | null = null;

export function getCrm(): CrmAdapter {
  if (!cached) {
    cached = config.crmProvider === 'rest' ? new RestCrmAdapter() : new MockCrmAdapter();
  }
  return cached;
}

export * from './types.js';
