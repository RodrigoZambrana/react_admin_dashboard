import { Injectable } from '@nestjs/common';

import {
  DocumentExtractionProfile,
  DocumentExtractionProfileId,
} from './document-extraction-profile.types';
import { DocumentExtractionProfileConfigService } from './document-extraction-profile-config.service';
import { ProductCatalogDocumentProfile } from './profiles/product-catalog-document.profile';

@Injectable()
export class DocumentExtractionProfileRegistryService {
  private readonly profiles: DocumentExtractionProfile[];

  constructor(
    configService: DocumentExtractionProfileConfigService = new DocumentExtractionProfileConfigService(),
    productCatalogProfile: ProductCatalogDocumentProfile = new ProductCatalogDocumentProfile(
      configService,
    ),
  ) {
    this.profiles = [productCatalogProfile];
  }

  listProfiles() {
    return [...this.profiles];
  }

  getProfilesByIds(profileIds: readonly DocumentExtractionProfileId[]) {
    return this.profiles.filter((profile) => profileIds.includes(profile.id));
  }
}
