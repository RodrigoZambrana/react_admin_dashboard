import { Injectable } from '@nestjs/common';

import {
  buildStructuralKnowledgeSummary,
  resolveStructuralKnowledgeAxisLabel,
} from '../documents/document-knowledge-claims';
import type {
  DocumentKnowledgeAxisSummary,
  DocumentKnowledgeMetadataSummary,
} from '../documents/document.types';
import type {
  AssembledPromptView,
  AssembledPromptRequest,
  InterpretationInput,
  LanguageModelInterpretationRequest,
  LanguageModelResponseGenerationRequest,
  ResponseGenerationInput,
} from './ai-gateway.types';
import { AiPromptContractService } from './ai-prompt-contract.service';
import { AiPromptPolicyService } from './ai-prompt-policy.service';

@Injectable()
export class AiPromptAssemblyService {
  constructor(
    private readonly promptPolicyService: AiPromptPolicyService,
    private readonly promptContractService: AiPromptContractService,
  ) {}

  async buildInterpretationRequest(
    input: InterpretationInput,
  ): Promise<AssembledPromptRequest<LanguageModelInterpretationRequest>> {
    const prompt = await this.describeInterpretationPrompt({
      locale: input.locale,
      promptTemplate: input.promptTemplate,
    });

    return {
      promptId: prompt.promptId,
      promptVersion: prompt.promptVersion,
      request: {
        systemPrompt: prompt.assembledSystemPrompt,
        message: input.message,
        locale: input.locale,
        previousMessages: input.previousMessages ?? [],
      },
    };
  }

  async buildResponseRequest(
    input: ResponseGenerationInput,
  ): Promise<AssembledPromptRequest<LanguageModelResponseGenerationRequest>> {
    const prompt = await this.describeResponsePrompt({
      locale: input.approvedContext.locale,
      promptTemplate: input.promptTemplate,
    });

    return {
      promptId: prompt.promptId,
      promptVersion: prompt.promptVersion,
      request: {
        systemPrompt: this.buildSystemPrompt({
          policyLayer: prompt.effectivePolicy,
          locale: input.approvedContext.locale,
          safetyLines: prompt.safetyLines,
          contractLines: prompt.contractLines,
          contextualLayers: this.buildResponseContextualLayers(
            input.approvedContext,
          ),
        }),
        approvedContext: input.approvedContext,
        approvedDraft: input.approvedDraft,
      },
    };
  }

  async describeInterpretationPrompt(input: {
    locale?: string;
    promptTemplate?: string;
  }): Promise<AssembledPromptView> {
    const policy = await this.promptPolicyService.resolveInterpretationPolicy(
      input.promptTemplate,
    );

    return this.buildPromptView('interpretation', policy, {
      locale: input.locale,
      safetyLines: this.promptContractService.buildInterpretationSafetyLines(),
      contractLines: this.promptContractService.buildInterpretationContractLines(),
    });
  }

  async describeResponsePrompt(input: {
    locale?: string;
    promptTemplate?: string;
  }): Promise<AssembledPromptView> {
    const policy = await this.promptPolicyService.resolveResponsePolicy(
      input.promptTemplate,
    );

    return this.buildPromptView('response', policy, {
      locale: input.locale,
      safetyLines: this.promptContractService.buildResponseSafetyLines(),
      contractLines: this.promptContractService.buildResponseContractLines(),
    });
  }

  private buildPromptView(
    key: 'interpretation' | 'response',
    policyLayer: Awaited<
      ReturnType<AiPromptPolicyService['resolveInterpretationPolicy']>
    >,
    input: {
      locale?: string;
      safetyLines: string[];
      contractLines: string[];
    },
  ): AssembledPromptView {
    return {
      key,
      promptId: policyLayer.promptId,
      promptVersion: policyLayer.promptVersion,
      source: policyLayer.source,
      localeHint: input.locale ?? null,
      effectivePolicy: policyLayer.value,
      recommendedPolicy: policyLayer.recommendedValue,
      differsFromRecommended: policyLayer.differsFromRecommended,
      managedPromptStatus: policyLayer.managedPromptStatus,
      managedPromptCreatedAt: policyLayer.managedPromptCreatedAt,
      managedPromptCreatedBy: policyLayer.managedPromptCreatedBy,
      safetyLines: input.safetyLines,
      contractLines: input.contractLines,
      assembledSystemPrompt: this.buildSystemPrompt({
        policyLayer: policyLayer.value,
        locale: input.locale,
        safetyLines: input.safetyLines,
        contractLines: input.contractLines,
      }),
    };
  }

  private buildSystemPrompt(input: {
    policyLayer: string;
    locale?: string;
    safetyLines: string[];
    contractLines: string[];
    contextualLayers?: Array<{
      title: string;
      lines: string[];
    }>;
  }) {
    return [
      'Fixed safety layer:',
      ...input.safetyLines.map((line) => this.formatLayerLine(line)),
      '',
      'Governed editorial policy layer:',
      input.policyLayer.trim(),
      '',
      ...(input.contextualLayers ?? []).flatMap((layer) =>
        layer.lines.length > 0
          ? [
              layer.title,
              ...layer.lines.map((line) => this.formatLayerLine(line)),
              '',
            ]
          : [],
      ),
      `Requested locale hint: ${input.locale ?? 'unknown'}`,
      '',
      'Backend-owned contract layer:',
      ...input.contractLines.map((line) => this.formatLayerLine(line)),
    ]
      .filter((line, index, lines) => {
        if (line.length > 0) {
          return true;
        }

        return lines[index - 1] !== '';
      })
      .join('\n')
      .trim();
  }

  private buildResponseContextualLayers(
    approvedContext: ResponseGenerationInput['approvedContext'],
  ) {
    const documentContext = approvedContext.documentContext;

    if (!documentContext || documentContext.matches.length === 0) {
      return [];
    }

    const factLines = dedupePromptLines(
      documentContext.matches.flatMap((match) =>
        (match.supportSummary?.axisSummaries ?? [])
          .map((summary) =>
            renderFactSummaryLine(summary, approvedContext.locale),
          )
          .filter((line): line is string => line.length > 0),
      ),
    ).slice(0, 6);
    const workflowLines = dedupePromptLines(
      documentContext.matches.flatMap((match) =>
        (match.supportSummary?.metadataNotes ?? [])
          .filter((note) => note.layer === 'workflow')
          .map((note) => renderMetadataSummaryLine(note, approvedContext.locale))
          .filter((line): line is string => line.length > 0),
      ),
    ).slice(0, 4);
    const guidanceLines = dedupePromptLines(
      documentContext.matches.flatMap((match) =>
        (match.supportSummary?.metadataNotes ?? [])
          .filter((note) => note.layer === 'guidance')
          .map((note) => renderMetadataSummaryLine(note, approvedContext.locale))
          .filter((line): line is string => line.length > 0),
      ),
    ).slice(0, 4);
    const layers: Array<{
      title: string;
      lines: string[];
    }> = [];

    if (factLines.length > 0) {
      layers.push({
        title: 'Tenant-grounded factual layer:',
        lines: factLines,
      });
    }

    if (workflowLines.length > 0) {
      layers.push({
        title: 'Tenant-grounded workflow layer:',
        lines: workflowLines,
      });
    }

    if (guidanceLines.length > 0) {
      layers.push({
        title: 'Tenant-grounded conversational guidance layer:',
        lines: guidanceLines,
      });
    }

    return layers;
  }

  private formatLayerLine(line: string) {
    return line.startsWith('  -') ? line : `- ${line}`;
  }
}

function renderFactSummaryLine(
  summary: DocumentKnowledgeAxisSummary,
  locale?: string,
) {
  const rendered = buildStructuralKnowledgeSummary({
    locale,
    claims: [summary],
    limit: 1,
  }).trim();

  return rendered ? truncatePromptLine(rendered, 180) : '';
}

function renderMetadataSummaryLine(
  note: DocumentKnowledgeMetadataSummary,
  locale?: string,
) {
  const label = resolveStructuralKnowledgeAxisLabel(note.axis, locale);
  const scopedContext = renderScopedContext(note);
  const values = note.values.slice(0, 4).join('; ').trim();

  if (!values) {
    return '';
  }

  return truncatePromptLine(
    `${label}${scopedContext ? ` (${scopedContext})` : ''}: ${values}`,
    220,
  );
}

function renderScopedContext(
  note: Pick<DocumentKnowledgeMetadataSummary, 'subject' | 'appliesTo'>,
) {
  const scopedValues = [
    note.subject?.value?.trim() ?? '',
    ...(note.appliesTo ?? []).map((scope) => scope.value.trim()),
  ].filter((value) => value.length > 0);

  return scopedValues.join(' / ');
}

function truncatePromptLine(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/gu, ' ');

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function dedupePromptLines(lines: string[]) {
  return Array.from(
    new Set(lines.map((line) => line.trim()).filter((line) => line.length > 0)),
  );
}
