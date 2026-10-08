import type { Services } from '@/services/container';
import type { EntityRef } from './entity';

/**
 * AI — STANDBY (sections 40/64).
 *
 * Contracts only: NO model calls, NO API keys, NO costs. They are already
 * implemented by every module with plain, deterministic code (and unit
 * tested), so the future assistant ("¿Qué tengo mañana?", "Convierte este
 * correo en una tarea") only has to plug a model in — on the backend.
 *
 *  - AIContextSource: read-only facts a module can contribute to an answer.
 *  - AITool: a typed action a model may *propose*; tools that change data
 *    (`mutates`) always need the user's explicit confirmation in the UI.
 */
export interface AIContextChunk {
  ref?: EntityRef;
  /** One compact, self-contained line ("2026-10-08 17:00 Fútbol Elisa · Familia"). */
  text: string;
  timestamp?: string;
  route?: string;
}

export interface AIContextRequest {
  /** Free text from the user (used for matching, never sent anywhere here). */
  query: string;
  now: Date;
  /** Time window of interest (defaults: today → +7 days). */
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface AIContextSource {
  id: string;
  moduleId: string;
  /** For the model (English): what this source can answer about. */
  description: string;
  getContext(services: Services, req: AIContextRequest): Promise<AIContextChunk[]>;
}

export type AIParamType = 'string' | 'number' | 'boolean' | 'date' | 'time';

export interface AIToolParam {
  type: AIParamType;
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface AIToolResult {
  /** Short human summary of what happened ("Tarea «Pagar seguro» creada para el 9 oct"). */
  summary: string;
  ref?: EntityRef;
  route?: string;
  data?: unknown;
}

export interface AITool<Input extends Record<string, unknown> = Record<string, unknown>> {
  /** Stable, model-friendly name: "todo.create_task". */
  name: string;
  moduleId: string;
  /** For the model (English). */
  description: string;
  parameters: Record<string, AIToolParam>;
  /** Changes user data → the assistant must ask for confirmation first. */
  mutates: boolean;
  run(services: Services, input: Input): Promise<AIToolResult>;
}

/** What a module contributes to the future assistant. */
export interface ModuleAI {
  context?: AIContextSource[];
  tools?: AITool[];
}

/**
 * Model gateway. The real implementation will live behind the AUN backend
 * (keys never in the app). Today only `disabledAIProvider` exists.
 */
export interface AIProvider {
  readonly id: string;
  readonly available: boolean;
  /** i18n key explaining why it is not available. */
  readonly reasonKey?: string;
  answer(input: {
    question: string;
    context: AIContextChunk[];
    tools: AITool[];
  }): Promise<{ text: string; proposedCalls: { tool: string; input: Record<string, unknown> }[] }>;
}
