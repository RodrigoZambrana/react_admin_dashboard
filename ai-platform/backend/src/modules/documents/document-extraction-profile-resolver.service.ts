import { Injectable } from '@nestjs/common';

import {
  documentExtractionProfileIds,
  DocumentExtractionContext,
  DocumentExtractionProfileId,
} from './document-extraction-profile.types';
import { DocumentExtractionProfileRegistryService } from './document-extraction-profile-registry.service';

@Injectable()
export class DocumentExtractionProfileResolverService {
  constructor(
    private readonly registry: DocumentExtractionProfileRegistryService = new DocumentExtractionProfileRegistryService(),
  ) {}

  resolveProfiles(context: DocumentExtractionContext) {
    const explicitProfileIds = this.resolveExplicitProfileIds(context);
    const candidates =
      explicitProfileIds.length > 0
        ? this.registry.getProfilesByIds(explicitProfileIds)
        : this.registry.listProfiles();

    return candidates.filter((profile) => profile.supports(context));
  }

  resolveProfileIds(context: DocumentExtractionContext) {
    return this.resolveProfiles(context).map((profile) => profile.id);
  }

  private resolveExplicitProfileIds(context: DocumentExtractionContext) {
    const configured = Array.isArray(context.sourceMetadata?.extractionProfiles)
      ? context.sourceMetadata.extractionProfiles.filter(
          (value): value is DocumentExtractionProfileId =>
            typeof value === 'string' &&
            documentExtractionProfileIds.includes(
              value as DocumentExtractionProfileId,
            ),
        )
      : [];

    return Array.from(new Set(configured));
  }
}
