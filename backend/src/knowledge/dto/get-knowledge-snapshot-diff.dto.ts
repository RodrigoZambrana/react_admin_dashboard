import { IsOptional, IsString } from 'class-validator'

export class GetKnowledgeSnapshotDiffDto {
  @IsOptional()
  @IsString()
  compareToId?: string
}
