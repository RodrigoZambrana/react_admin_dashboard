import { Injectable } from '@nestjs/common';

import { DocumentKnowledgeExtractionOrchestrator } from './document-knowledge-extraction.orchestrator';

@Injectable()
export class DocumentKnowledgeExtractionService {
  constructor(
    private readonly orchestrator: DocumentKnowledgeExtractionOrchestrator = new DocumentKnowledgeExtractionOrchestrator(),
  ) {}

  buildChunkCandidates(
    ...args: Parameters<DocumentKnowledgeExtractionOrchestrator['buildChunkCandidates']>
  ) {
    return this.orchestrator.buildChunkCandidates(...args);
  }
}
