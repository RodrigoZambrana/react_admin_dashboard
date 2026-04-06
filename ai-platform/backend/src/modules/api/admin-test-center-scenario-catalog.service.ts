import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  DocumentKnowledgeClaimView,
  DocumentKnowledgePropositionView,
} from '../documents/document.types';
import { DocumentKnowledgeViewService } from '../documents/document-knowledge-view.service';
import type { TestCenterScenario } from './test-center.types';

type RawScenarioCatalog = {
  version?: number;
  locale?: string;
  scenarios?: Array<{
    id: string;
    label: string;
    description: string;
    category: TestCenterScenario['category'];
    tags?: string[];
    turns?: Array<{
      message: string;
      locale?: string;
      expectation?: TestCenterScenario['turns'][number]['expectation'];
    }>;
  }>;
};

@Injectable()
export class AdminTestCenterScenarioCatalogService {
  listScenarios = async (locale = 'es'): Promise<TestCenterScenario[]> => {
    const curatedScenarios = this.loadCuratedScenarios(locale);
    const derivedScenarios = await this.buildDerivedScenarios(locale);

    return [...curatedScenarios, ...derivedScenarios].sort((left, right) =>
      [left.sourceKind, left.label].join('::').localeCompare(
        [right.sourceKind, right.label].join('::'),
        locale,
      ),
    );
  };

  getScenario = async (scenarioId: string, locale = 'es') => {
    const scenarios = await this.listScenarios(locale);
    return scenarios.find((scenario) => scenario.id === scenarioId) ?? null;
  };

  constructor(
    private readonly documentKnowledgeViewService: DocumentKnowledgeViewService,
  ) {}

  private loadCuratedScenarios(locale: string): TestCenterScenario[] {
    const catalog = loadScenarioCatalog(locale);

    return (catalog.scenarios ?? []).map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      description: scenario.description,
      locale,
      sourceKind: 'curated',
      category: scenario.category,
      tags: normalizeTags(scenario.tags),
      turns: (scenario.turns ?? []).map((turn) => ({
        message: turn.message,
        locale: turn.locale ?? locale,
        expectation: turn.expectation,
      })),
    }));
  }

  private async buildDerivedScenarios(locale: string): Promise<TestCenterScenario[]> {
    const knowledgeView = await this.documentKnowledgeViewService.getKnowledgeView();
    const activeDocument = knowledgeView.documents[0];

    if (!activeDocument) {
      return [];
    }

    const scenarios: TestCenterScenario[] = [];
    const paymentScenario = buildDerivedPaymentScenario({
      locale,
      documentId: activeDocument.id,
      documentTitle: activeDocument.title,
      claims: knowledgeView.claims,
    });

    if (paymentScenario) {
      scenarios.push(paymentScenario);
    }

    const colorScenario = buildDerivedColorScenario({
      locale,
      documentId: activeDocument.id,
      documentTitle: activeDocument.title,
      claims: knowledgeView.claims,
    });

    if (colorScenario) {
      scenarios.push(colorScenario);
    }

    const visitScenario = buildDerivedVisitScenario({
      locale,
      documentId: activeDocument.id,
      documentTitle: activeDocument.title,
      claims: knowledgeView.claims,
      propositions: knowledgeView.propositions,
    });

    if (visitScenario) {
      scenarios.push(visitScenario);
    }

    const warrantyScenario = buildDerivedWarrantyScenario({
      locale,
      documentId: activeDocument.id,
      documentTitle: activeDocument.title,
      claims: knowledgeView.claims,
    });

    if (warrantyScenario) {
      scenarios.push(warrantyScenario);
    }

    return scenarios;
  }
}

function buildDerivedPaymentScenario(input: {
  locale: string;
  documentId: string;
  documentTitle: string;
  claims: DocumentKnowledgeClaimView[];
}): TestCenterScenario | null {
  const paymentMethods = uniqueValues(
    input.claims
      .filter((claim) => claim.axis === 'payment_methods')
      .flatMap((claim) => claim.values),
  );
  const installmentClaim = input.claims.find(
    (claim) =>
      (claim.axis === 'payment_terms' && claim.facet === 'installment_count') ||
      claim.axis === 'installment_count',
  );
  const cardBrandClaim = input.claims.find(
    (claim) => claim.axis === 'payment_terms' && claim.facet === 'card_brands',
  );

  if (paymentMethods.length === 0) {
    return null;
  }

  const installmentValue = installmentClaim?.values[0] ?? null;
  const cardBrands = uniqueValues(cardBrandClaim?.values ?? []);

  return {
    id: 'derived-payment-terms',
    label: 'Derivado: pagos y cuotas',
    description:
      'Generado desde el documento activo para validar medios de pago, cuotas y cierre conversacional.',
    locale: input.locale,
    sourceKind: 'derived',
    category: 'supported_information',
    tags: ['pagos', 'cuotas', 'derivado'],
    documentId: input.documentId,
    documentTitle: input.documentTitle,
    turns: [
      {
        message: 'que formas de pago aceptan?',
        locale: input.locale,
        expectation: {
          topicTerms: ['pago', ...paymentMethods],
          mustMentionAtLeast: [
            {
              terms: paymentMethods,
              count: Math.min(Math.max(paymentMethods.length - 1, 2), paymentMethods.length),
              label: 'medios de pago',
            },
          ],
          shouldAvoidStructuralSummary: true,
        },
      },
      {
        message: 'con mercado pago en cuantas cuotas se puede pagar?',
        locale: input.locale,
        expectation: {
          topicTerms: ['mercado pago', 'cuotas', installmentValue ?? 'cuotas'],
          mustMentionAll: installmentValue ? ['mercado pago', installmentValue] : ['mercado pago'],
          mustMentionAtLeast: [
            {
              terms: ['cuota', 'cuotas'],
              count: 1,
              label: 'cuotas',
            },
            ...(cardBrands.length > 0
              ? [
                  {
                    terms: cardBrands,
                    count: Math.min(2, cardBrands.length),
                    label: 'tarjetas',
                  },
                ]
              : []),
          ],
          shouldAvoidStructuralSummary: true,
        },
      },
      {
        message: 'muchas gracias por tu ayuda',
        locale: input.locale,
        expectation: {
          expectedClose: true,
          preferredResponseMode: 'close',
          shouldNotMention: ['mercado pago', 'cuotas', 'fecha', 'hora'],
          shouldAvoidStructuralSummary: true,
        },
      },
    ],
  };
}

function buildDerivedColorScenario(input: {
  locale: string;
  documentId: string;
  documentTitle: string;
  claims: DocumentKnowledgeClaimView[];
}): TestCenterScenario | null {
  const pvcColors = resolveScopedClaimValues(input.claims, {
    axis: 'color_options',
    scopeAxis: 'material',
    scopeValue: 'pvc',
  });
  const aluminumColors = resolveScopedClaimValues(input.claims, {
    axis: 'color_options',
    scopeAxis: 'material',
    scopeValue: 'aluminio',
  });

  if (pvcColors.length === 0 && aluminumColors.length === 0) {
    return null;
  }

  return {
    id: 'derived-enrollar-colors',
    label: 'Derivado: colores por material',
    description:
      'Generado desde el documento activo para validar colores de enrollar por material sin exponer salidas estructurales crudas.',
    locale: input.locale,
    sourceKind: 'derived',
    category: 'supported_information',
    tags: ['colores', 'pvc', 'aluminio', 'derivado'],
    documentId: input.documentId,
    documentTitle: input.documentTitle,
    turns: [
      {
        message: 'busco cortinas de enrollar',
        locale: input.locale,
      },
      {
        message: 'en pvc que colores tienen?',
        locale: input.locale,
        expectation: {
          topicTerms: ['pvc', ...pvcColors],
          mustMentionAtLeast: pvcColors.length
            ? [
                {
                  terms: pvcColors,
                  count: 1,
                  label: 'color pvc',
                },
              ]
            : undefined,
          shouldAvoidStructuralSummary: true,
        },
      },
      {
        message: 'y en aluminio?',
        locale: input.locale,
        expectation: {
          topicTerms: ['aluminio', ...aluminumColors],
          mustMentionAtLeast: aluminumColors.length
            ? [
                {
                  terms: aluminumColors,
                  count: Math.min(3, aluminumColors.length),
                  label: 'colores aluminio',
                },
              ]
            : undefined,
          shouldAvoidStructuralSummary: true,
        },
      },
      {
        message: 'gracias',
        locale: input.locale,
        expectation: {
          expectedClose: true,
          preferredResponseMode: 'close',
          shouldAvoidStructuralSummary: true,
        },
      },
    ],
  };
}

function buildDerivedVisitScenario(input: {
  locale: string;
  documentId: string;
  documentTitle: string;
  claims: DocumentKnowledgeClaimView[];
  propositions: DocumentKnowledgePropositionView[];
}): TestCenterScenario | null {
  const insideVisitValue = resolveScopedClaimValues(input.claims, {
    axis: 'commercial_visit_cost',
    scopeAxis: 'location_relation',
    scopeValue: 'inside',
  })[0];
  const montevideoVisitValue = resolveScopedClaimValues(input.claims, {
    axis: 'commercial_visit_cost',
    scopeAxis: 'location',
    scopeValue: 'montevideo',
  })[0];
  const outsideTravelSignals = input.propositions.filter((proposition) =>
    proposition.predicate === 'cost_condition' ||
    proposition.predicate === 'travel_cost_condition',
  );
  const hasOutsideSignal = outsideTravelSignals.some((proposition) =>
    proposition.relationScope.some(
      (scope) =>
        scope.axis === 'location_relation' &&
        (scope.normalizedValue ?? scope.value).toLowerCase() === 'outside',
    ),
  );

  if (!insideVisitValue && !montevideoVisitValue && !hasOutsideSignal) {
    return null;
  }

  return {
    id: 'derived-visit-coverage',
    label: 'Derivado: visita y cobertura',
    description:
      'Generado desde el documento activo para validar visita a domicilio, Montevideo y alcance fuera de Montevideo.',
    locale: input.locale,
    sourceKind: 'derived',
    category: 'supported_information',
    tags: ['visita', 'medidas', 'montevideo', 'derivado'],
    documentId: input.documentId,
    documentTitle: input.documentTitle,
    turns: [
      {
        message: 'toman medidas a domicilio?',
        locale: input.locale,
        expectation: {
          topicTerms: ['visita', 'medidas', 'domicilio'],
          mustMentionAtLeast: [
            {
              terms: ['visita', 'medidas', 'domicilio'],
              count: 2,
              label: 'visita a domicilio',
            },
          ],
          shouldAvoidStructuralSummary: true,
        },
      },
      {
        message: 'me encuentro en montevideo',
        locale: input.locale,
        expectation: {
          topicTerms: ['montevideo', insideVisitValue ?? montevideoVisitValue ?? 'sin costo'],
          mustMentionAll: ['montevideo'],
          mustMentionAtLeast: [
            {
              terms: [insideVisitValue ?? montevideoVisitValue ?? 'sin costo'],
              count: 1,
              label: 'condición en montevideo',
            },
          ],
          shouldAvoidStructuralSummary: true,
        },
      },
      {
        message: 'y fuera de montevideo?',
        locale: input.locale,
        expectation: {
          topicTerms: ['fuera de montevideo', 'traslado', 'costo'],
          mustMentionAtLeast: [
            {
              terms: ['traslado', 'costo', 'puede corresponder', 'puede tener costo'],
              count: 2,
              label: 'costo fuera de montevideo',
            },
          ],
          allowPrudentUnknown: true,
          shouldAvoidStructuralSummary: true,
        },
      },
      {
        message: 'gracias por la ayuda',
        locale: input.locale,
        expectation: {
          expectedClose: true,
          preferredResponseMode: 'close',
          shouldAvoidStructuralSummary: true,
        },
      },
    ],
  };
}

function buildDerivedWarrantyScenario(input: {
  locale: string;
  documentId: string;
  documentTitle: string;
  claims: DocumentKnowledgeClaimView[];
}): TestCenterScenario | null {
  const warrantyValues = uniqueValues(
    input.claims
      .filter((claim) => claim.axis === 'warranty')
      .flatMap((claim) => claim.values),
  );

  if (warrantyValues.length === 0) {
    return null;
  }

  return {
    id: 'derived-warranty-check',
    label: 'Derivado: garantía',
    description:
      'Generado desde el documento activo para validar garantía en formato customer-facing.',
    locale: input.locale,
    sourceKind: 'derived',
    category: 'supported_information',
    tags: ['garantía', 'derivado'],
    documentId: input.documentId,
    documentTitle: input.documentTitle,
    turns: [
      {
        message: 'que garantia tiene el producto?',
        locale: input.locale,
        expectation: {
          topicTerms: ['garantía', ...warrantyValues],
          mustMentionAtLeast: [
            {
              terms: warrantyValues,
              count: 1,
              label: 'garantía',
            },
          ],
          shouldAvoidStructuralSummary: true,
        },
      },
      {
        message: 'excelente muchas gracias',
        locale: input.locale,
        expectation: {
          expectedClose: true,
          preferredResponseMode: 'close',
          shouldAvoidStructuralSummary: true,
        },
      },
    ],
  };
}

function resolveScopedClaimValues(
  claims: DocumentKnowledgeClaimView[],
  input: {
    axis: string;
    scopeAxis: string;
    scopeValue: string;
  },
) {
  return uniqueValues(
    claims
      .filter((claim) => claim.axis === input.axis)
      .filter((claim) =>
        claim.appliesTo.some(
          (scope) =>
            scope.axis === input.scopeAxis &&
            (scope.normalizedValue ?? scope.value).toLowerCase() === input.scopeValue,
        ),
      )
      .flatMap((claim) => claim.values),
  );
}

function loadScenarioCatalog(locale: string) {
  const localizedPath = resolve(
    __dirname,
    `../../resources/test-center/scenarios/${locale}.json`,
  );
  const fallbackPath = resolve(
    __dirname,
    '../../resources/test-center/scenarios/es.json',
  );
  const resolvedPath = existsSync(localizedPath) ? localizedPath : fallbackPath;

  return JSON.parse(readFileSync(resolvedPath, 'utf8')) as RawScenarioCatalog;
}

function uniqueValues(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function normalizeTags(tags?: string[]) {
  return uniqueValues(Array.isArray(tags) ? tags : []);
}
