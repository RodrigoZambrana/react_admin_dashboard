import { Injectable } from '@nestjs/common';
import { MessageRole } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { MemoryService } from '../memory/memory.service';
import { ChatLogRepository } from '../persistence/repositories/chat-log.repository';
import { ConversationRepository } from '../persistence/repositories/conversation.repository';
import { InfrastructureRepository } from '../persistence/repositories/infrastructure.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import { QdrantStoreService } from '../knowledge/qdrant-store.service';
import { AiRuntimeDiagnosticsService } from '../runtime-config/ai-runtime-diagnostics.service';

const requiredTables = [
  'ChatLog',
  'Conversation',
  'Knowledge',
  'Message',
  'PromptVersion',
];

@Injectable()
export class InfrastructureService {
  constructor(
    private readonly infrastructureRepository: InfrastructureRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly chatLogRepository: ChatLogRepository,
    private readonly memoryService: MemoryService,
    private readonly qdrantStoreService: QdrantStoreService,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PipelineLoggerService,
    private readonly aiRuntimeDiagnosticsService: AiRuntimeDiagnosticsService,
  ) {}

  async getReadiness() {
    const [databaseOk, tables, redis, qdrant, aiRuntime] = await Promise.all([
      this.infrastructureRepository.pingDatabase(),
      this.infrastructureRepository.listPublicTables(),
      this.memoryService.ping(),
      this.qdrantStoreService.healthCheck(),
      this.aiRuntimeDiagnosticsService.getDiagnostics(),
    ]);

    const tablesOk = requiredTables.every((tableName) =>
      tables.some(
        (existingTable) => existingTable.toLowerCase() === tableName.toLowerCase(),
      ),
    );
    const aiRuntimeStatus = aiRuntime.exploratoryReady
      ? 'ok'
      : aiRuntime.status === 'invalid'
        ? 'error'
        : 'warning';

    const readiness = {
      status:
        databaseOk &&
        tablesOk &&
        redis.status === 'ok' &&
        qdrant.status === 'ok' &&
        aiRuntime.exploratoryReady
          ? 'ready'
          : 'not_ready',
      services: {
        postgres: {
          status: databaseOk ? 'ok' : 'error',
          tables,
        },
        redis,
        qdrant,
        aiRuntime: {
          status: aiRuntimeStatus,
          provider: aiRuntime.provider,
          model: aiRuntime.model,
          source: aiRuntime.source,
          canUseRuntime: aiRuntime.canUseRuntime,
          exploratoryReady: aiRuntime.exploratoryReady,
          issues: aiRuntime.issues,
        },
      },
    };

    this.logger.log(
      JSON.stringify({
        stage: 'infrastructure.readiness',
        output: readiness,
      }),
    );

    return readiness;
  }

  async validatePersistenceForTenant(tenantId: string) {
    return this.tenantContext.run({ tenantId, traceId: `infra-${tenantId}` }, async () => {
      const conversation = await this.conversationRepository.createConversation('es');
      const userMessage = await this.conversationRepository.appendMessage(
        conversation.id,
        MessageRole.USER,
        `infra validation for ${tenantId}`,
      );
      const chatLog = await this.chatLogRepository.createLog({
        conversationId: conversation.id,
        traceId: this.tenantContext.getTraceId(),
        stage: 'infra.validation',
        status: 'completed',
        payload: {
          conversationId: conversation.id,
          messageId: userMessage.id,
        },
      });
      const scopedConversation = await this.conversationRepository.findById(
        conversation.id,
      );

      return {
        conversation,
        userMessage,
        chatLog,
        scopedConversation,
      };
    });
  }
}
