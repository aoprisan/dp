import { stylist } from './stylist';
import { packing } from './packing';
import { audit } from './audit';
import { shopping } from './shopping';
import type { PromptTemplate } from '../serializer';

export const templates: PromptTemplate[] = [stylist, packing, audit, shopping];
export { stylist, packing, audit, shopping };
