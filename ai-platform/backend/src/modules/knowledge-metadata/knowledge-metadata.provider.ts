import { RuntimeManagedResourceProvider } from '../runtime-resources/runtime-managed-resource.provider';
import {
  KnowledgeMetadataKey,
  KnowledgeMetadataResource,
} from './knowledge-metadata.types';

export abstract class KnowledgeMetadataProvider extends RuntimeManagedResourceProvider<
  KnowledgeMetadataKey,
  KnowledgeMetadataResource
> {}
