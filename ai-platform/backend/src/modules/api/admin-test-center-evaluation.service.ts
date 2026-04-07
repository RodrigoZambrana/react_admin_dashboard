import { Injectable } from '@nestjs/common';

import { summarySeeksProductContext } from '../response/response-grounding.catalogs';

import type {
  TestCenterConversationEvaluation,
  TestCenterReplayTurnResult,
  TestCenterScenario,
  TestCenterTurnEvaluation,
  TestCenterTurnExpectation,
} from './test-center.types';

@Injectable()
export class AdminTestCenterEvaluationService {
  evaluateScenarioRun(input: {
    scenario: TestCenterScenario;
    turns: TestCenterReplayTurnResult[];
  }): TestCenterConversationEvaluation {
    const turnEvaluations = input.turns.map((turn, index) =>
      this.evaluateTurn({
        turn,
        turnIndex: index,
        expectation: input.scenario.turns[index]?.expectation,
      }),
    );

    const correctnessScore = averageScore(turnEvaluations, 'correctnessScore');
    const coherenceScore = averageScore(turnEvaluations, 'coherenceScore');
    const fluencyScore = averageScore(turnEvaluations, 'fluencyScore');
    const writingQualityScore = averageScore(turnEvaluations, 'writingQualityScore');
    const overallScore = roundScore(
      correctnessScore * 0.4 +
        coherenceScore * 0.25 +
        fluencyScore * 0.2 +
        writingQualityScore * 0.15,
    );
    const status = resolveMetricStatus(overallScore);
    const summaryLines = buildConversationSummaryLines({
      scenario: input.scenario,
      turnEvaluations,
      overallScore,
      correctnessScore,
      coherenceScore,
      fluencyScore,
      writingQualityScore,
    });

    return {
      scenarioId: input.scenario.id,
      scenarioLabel: input.scenario.label,
      scenarioSourceKind: input.scenario.sourceKind,
      locale: input.scenario.locale,
      overallScore,
      correctnessScore,
      coherenceScore,
      fluencyScore,
      writingQualityScore,
      status,
      summaryLines,
      turns: turnEvaluations,
    };
  }

  private evaluateTurn(input: {
    turn: TestCenterReplayTurnResult;
    turnIndex: number;
    expectation?: TestCenterTurnExpectation;
  }): TestCenterTurnEvaluation {
    const issues: string[] = [];
    const matchedSignals: string[] = [];
    const response = input.turn.response ?? '';
    const normalizedResponse = normalizeForCheck(response);
    const expectation = input.expectation;

    let correctnessScore = 100;
    let coherenceScore = 100;
    let fluencyScore = 100;
    let writingQualityScore = 100;

    if (expectation) {
      for (const term of expectation.mustMentionAll ?? []) {
        if (!containsTerm(normalizedResponse, term)) {
          correctnessScore -= 18;
          issues.push(`Falta mencionar: ${term}`);
        } else {
          matchedSignals.push(`Menciona ${term}`);
        }
      }

      for (const group of expectation.mustMentionAtLeast ?? []) {
        const matchCount = group.terms.filter((term) => containsTerm(normalizedResponse, term))
          .length;

        if (matchCount < group.count) {
          correctnessScore -= 22;
          issues.push(
            `Cobertura insuficiente para ${group.label ?? 'detalle esperado'} (${matchCount}/${group.count})`,
          );
        } else {
          matchedSignals.push(
            `${group.label ?? 'detalle esperado'} cubierto (${matchCount}/${group.count})`,
          );
        }
      }

      for (const term of expectation.shouldNotMention ?? []) {
        if (containsTerm(normalizedResponse, term)) {
          correctnessScore -= 15;
          coherenceScore -= 12;
          issues.push(`Menciona algo que debía evitar: ${term}`);
        }
      }

      const topicTerms = expectation.topicTerms ?? [];
      if (topicTerms.length > 0) {
        const topicMatches = topicTerms.filter((term) =>
          containsTerm(normalizedResponse, term),
        ).length;

        if (topicMatches === 0) {
          coherenceScore -= 28;
          issues.push('La respuesta no quedó claramente anclada al tema del turno.');
        } else if (topicMatches < Math.min(2, topicTerms.length)) {
          coherenceScore -= 10;
        } else {
          matchedSignals.push(`Tema del turno bien anclado (${topicMatches})`);
        }
      }

      if (expectation.allowPrudentUnknown) {
        if (looksPrudentUnknown(response)) {
          matchedSignals.push('Usa prudencia explícita');
        } else {
          correctnessScore -= 8;
          issues.push('Faltó una prudencia explícita si el dato no era totalmente seguro.');
        }
      }

      if (expectation.shouldAskFollowUpQuestion) {
        if (looksFollowUpClarification(response, input.turn.locale)) {
          matchedSignals.push('Pide contexto adicional de forma explícita');
        } else {
          correctnessScore -= 18;
          coherenceScore -= 12;
          issues.push(
            'Faltó una pregunta de seguimiento para obtener contexto antes de responder con precisión.',
          );
        }
      }

      if (expectation.expectedClose) {
        if (looksCloseResponse(response)) {
          matchedSignals.push('Cierre conversacional correcto');
        } else {
          correctnessScore -= 40;
          coherenceScore -= 15;
          issues.push('No cerró el hilo cuando el turno lo pedía.');
        }
      }
    }

    if (looksStructuralSummary(response)) {
      correctnessScore -= 18;
      fluencyScore -= 50;
      writingQualityScore -= 45;
      issues.push('Expone una salida estructural cruda en vez de una respuesta customer-facing.');
    }

    if (expectation?.shouldAvoidStructuralSummary && looksStructuralSummary(response)) {
      correctnessScore -= 12;
    }

    if (hasRepeatedRawSeparators(response)) {
      fluencyScore -= 12;
      writingQualityScore -= 12;
      issues.push('La redacción tiene separadores o puntuación poco natural.');
    }

    if (!looksWellWritten(response)) {
      writingQualityScore -= 18;
      issues.push('La redacción quedó pobre o demasiado telegráfica.');
    }

    if (expectation?.shouldPreferMultiline) {
      if (looksPreferredMultiline(response)) {
        matchedSignals.push('Usa multilinea cuando el turno lo amerita');
      } else {
        fluencyScore -= 10;
        writingQualityScore -= 10;
        issues.push('La respuesta debió separarse mejor en bloques o párrafos.');
      }
    }

    if (looksMidThreadGreeting(response) && input.turnIndex > 0) {
      fluencyScore -= 15;
      coherenceScore -= 12;
      issues.push('Reabre con saludo en medio del hilo.');
    }

    correctnessScore = clampScore(correctnessScore);
    coherenceScore = clampScore(coherenceScore);
    fluencyScore = clampScore(fluencyScore);
    writingQualityScore = clampScore(writingQualityScore);

    const overallScore = roundScore(
      correctnessScore * 0.4 +
        coherenceScore * 0.25 +
        fluencyScore * 0.2 +
        writingQualityScore * 0.15,
    );

    return {
      turnIndex: input.turnIndex,
      traceId: input.turn.traceId,
      userMessage: input.turn.input,
      assistantMessage: response,
      overallScore,
      correctnessScore,
      coherenceScore,
      fluencyScore,
      writingQualityScore,
      status: resolveMetricStatus(overallScore),
      issues,
      matchedSignals,
    };
  }
}

function buildConversationSummaryLines(input: {
  scenario: TestCenterScenario;
  turnEvaluations: TestCenterTurnEvaluation[];
  overallScore: number;
  correctnessScore: number;
  coherenceScore: number;
  fluencyScore: number;
  writingQualityScore: number;
}) {
  const failedTurns = input.turnEvaluations.filter((turn) => turn.status === 'fail');
  const warningTurns = input.turnEvaluations.filter((turn) => turn.status === 'warn');
  const summaryLines = [
    `Escenario ${input.scenario.label}: overall ${input.overallScore}/100.`,
    `Correctitud ${input.correctnessScore}/100 · coherencia ${input.coherenceScore}/100 · fluidez ${input.fluencyScore}/100 · redacción ${input.writingQualityScore}/100.`,
  ];

  if (failedTurns.length > 0) {
    summaryLines.push(
      `Hay ${failedTurns.length} turno(s) fallidos: ${failedTurns
        .map((turn) => `#${turn.turnIndex + 1}`)
        .join(', ')}.`,
    );
  } else if (warningTurns.length > 0) {
    summaryLines.push(
      `Hay ${warningTurns.length} turno(s) con advertencias: ${warningTurns
        .map((turn) => `#${turn.turnIndex + 1}`)
        .join(', ')}.`,
    );
  } else {
    summaryLines.push('Todos los turnos evaluados quedaron en nivel aceptable.');
  }

  return summaryLines;
}

function averageScore<T extends keyof TestCenterTurnEvaluation>(
  turns: TestCenterTurnEvaluation[],
  key: T,
) {
  if (turns.length === 0) {
    return 0;
  }

  const total = turns.reduce((accumulator, turn) => accumulator + Number(turn[key] ?? 0), 0);
  return roundScore(total / turns.length);
}

function resolveMetricStatus(score: number): TestCenterTurnEvaluation['status'] {
  if (score < 60) {
    return 'fail';
  }

  if (score < 80) {
    return 'warn';
  }

  return 'pass';
}

function containsTerm(normalizedResponse: string, term: string) {
  return normalizedResponse.includes(normalizeForCheck(term));
}

function normalizeForCheck(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

function looksPrudentUnknown(value: string) {
  const normalized = normalizeForCheck(value);
  return (
    normalized.includes('no tengo confirmacion') ||
    normalized.includes('no tengo una confirmacion') ||
    normalized.includes('no se especifica') ||
    normalized.includes('por ahora no cuento con')
  );
}

function looksCloseResponse(value: string) {
  const normalized = normalizeForCheck(value);
  if (
    normalized.includes('fecha') ||
    normalized.includes('hora') ||
    normalized.includes('reserva') ||
    normalized.includes('cuando te queda')
  ) {
    return false;
  }

  return (
    normalized.includes('a disposicion') ||
    normalized.includes('quedamos a disposicion') ||
    normalized.includes('si necesitas algo mas') ||
    normalized.includes('si precisas algo mas') ||
    normalized.includes('gracias por escribir') ||
    normalized.includes('gracias por tu mensaje')
  );
}

function looksStructuralSummary(value: string) {
  return (
    /^[A-ZÁÉÍÓÚÜÑ][^.!?\n]{0,80}\([^)\n]+\):/u.test(value) ||
    /^[A-ZÁÉÍÓÚÜÑ][^.!?\n]{0,80}:\s+/u.test(value) ||
    /\blocation relation\b/iu.test(value) ||
    /\bpayment method\b/iu.test(value) ||
    /\bmaterial [A-ZÁÉÍÓÚÜÑ]/u.test(value)
  );
}

function hasRepeatedRawSeparators(value: string) {
  return /(?:;\s*){2,}/u.test(value) || /::/u.test(value);
}

function looksWellWritten(value: string) {
  const trimmed = value.trim();

  if (trimmed.length < 12) {
    return false;
  }

  if (!/[.!?]$/u.test(trimmed)) {
    return false;
  }

  return !/[ \t]{2,}/u.test(trimmed);
}

function looksMidThreadGreeting(value: string) {
  return /^(hola|buenas|buen dia|buenos dias|buenas tardes)\b/iu.test(value.trim());
}

function looksFollowUpClarification(
  value: string,
  locale?: string | null,
) {
  const trimmed = value.trim();
  const normalized = normalizeForCheck(trimmed);

  if (summarySeeksProductContext(locale, value)) {
    return true;
  }

  const hasFollowUpPrompt =
    trimmed.includes('?') ||
    trimmed.includes('¿') ||
    normalized.includes('si me indicas') ||
    normalized.includes('si me decis') ||
    normalized.includes('si me decís') ||
    normalized.includes('contame') ||
    normalized.includes('decime') ||
    normalized.includes('podrias indicarme') ||
    normalized.includes('podrías indicarme');

  if (!hasFollowUpPrompt) {
    return false;
  }

  return (
    normalized.includes('que producto') ||
    normalized.includes('qué producto') ||
    normalized.includes('que variante') ||
    normalized.includes('qué variante') ||
    normalized.includes('que linea') ||
    normalized.includes('qué linea') ||
    normalized.includes('que linea') ||
    normalized.includes('qué línea') ||
    normalized.includes('que material') ||
    normalized.includes('qué material') ||
    normalized.includes('cual de') ||
    normalized.includes('cuál de')
  );
}

function looksPreferredMultiline(value: string) {
  const trimmed = value.trim();

  if (trimmed.length < 90) {
    return true;
  }

  return /\n\s*\n/u.test(trimmed);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, roundScore(value)));
}

function roundScore(value: number) {
  return Math.round(value);
}
