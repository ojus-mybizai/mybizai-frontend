/**
 * Agent Builder service — typed wrappers around /agent-builder/* endpoints.
 */
import { apiFetch } from '@/lib/api-client'

// ── API shapes (snake_case from backend) ──────────────────────

interface ApiMessage {
  role: string
  content: string
  timestamp: string
}

interface ApiBlueprintAgent {
  index: number
  name: string
  persona_name: string
  role_type: string
  description: string
  tone: string
  skills: string[]
  triggers: Record<string, unknown>[]
  why: string
  estimated_monthly_runs: number
  channel_deploy: string[]
  status: string
  built_agent_id: number | null
}

interface ApiBlueprintResponse {
  agents: ApiBlueprintAgent[]
  rationale: string
  estimated_time_saved_per_week: string
  coverage_gaps: string[]
}

interface ApiStartSession {
  session_id: string
  message: string
  stage: string
}

// Phase-5 discovery checklist — backend-authoritative shape.
// All fields filled incrementally by the architect via the
// `update_discovery_checklist` skill. Frontend uses this to drive
// the live progress side-panel.
interface ApiDiscovery {
  primary_goal?: string | null
  audience?: 'customer' | 'team' | 'both' | null
  autonomy?: 'independent' | 'approval_required' | null
  top_failure_modes?: string[] | null
  escalation_triggers?: string[] | null
  success_metric?: string | null
  available_data_sources?: string[] | null
}

interface ApiDiscoveryProgress {
  filled: number
  total: number
  ready_to_propose: boolean
  missing: string[]
}

interface ApiArchitectResponse {
  message: string
  stage: string
  blueprint: ApiBlueprintResponse | null
  ready_to_build: boolean
  discovery?: ApiDiscovery | null
  discovery_progress?: ApiDiscoveryProgress | null
}

// Phase-5 instruction preview shapes (POST /preview-instructions)
interface ApiInstructionPreviewItem {
  agent_index: number
  agent_name: string
  instructions: string
  quality: 'ok' | 'needs_review'
  issues: string[]
}

interface ApiPreviewInstructionsResponse {
  items: ApiInstructionPreviewItem[]
  overall_quality: 'ok' | 'needs_review'
}

interface ApiBuildResponse {
  message: string
  built_agents: { id: number; name: string }[]
  stage: string
}

interface ApiSessionDetail {
  session_id: string
  stage: string
  messages: ApiMessage[]
  blueprint: ApiBlueprintResponse | null
  built_agents: { id: number; name: string }[] | null
  created_at: string
  discovery?: ApiDiscovery | null
  discovery_progress?: ApiDiscoveryProgress | null
  previewed_instructions?: Record<
    string,
    { instructions: string; quality: 'ok' | 'needs_review'; issues: string[] }
  > | null
}

// ── Frontend shapes (camelCase) ───────────────────────────────

export interface BuilderMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface BlueprintAgent {
  index: number
  name: string
  personaName: string
  roleType: string
  description: string
  tone: string
  skills: string[]
  triggers: Record<string, unknown>[]
  why: string
  estimatedMonthlyRuns: number
  channelDeploy: string[]
  status: string
  builtAgentId: number | null
}

export interface Blueprint {
  agents: BlueprintAgent[]
  rationale: string
  estimatedTimePerWeek: string
  coverageGaps: string[]
}

// Phase-5 frontend types ──────────────────────────────────────

export interface DiscoveryChecklist {
  primaryGoal: string | null
  audience: 'customer' | 'team' | 'both' | null
  autonomy: 'independent' | 'approval_required' | null
  topFailureModes: string[]
  escalationTriggers: string[]
  successMetric: string | null
  availableDataSources: string[]
}

export interface DiscoveryProgress {
  filled: number
  total: number
  readyToPropose: boolean
  missing: string[]
}

export type InstructionsQuality = 'ok' | 'needs_review'

export interface InstructionPreviewItem {
  agentIndex: number
  agentName: string
  instructions: string
  quality: InstructionsQuality
  issues: string[]
}

export interface PreviewInstructionsResult {
  items: InstructionPreviewItem[]
  overallQuality: InstructionsQuality
}

// ── Architect / Build / Session response shapes ──────────────

export interface ArchitectResponse {
  message: string
  stage: string
  blueprint: Blueprint | null
  readyToBuild: boolean
  discovery: DiscoveryChecklist | null
  discoveryProgress: DiscoveryProgress | null
}

export interface BuildResponse {
  message: string
  builtAgents: { id: number; name: string }[]
  stage: string
}

export interface SessionDetail {
  sessionId: string
  stage: string
  messages: BuilderMessage[]
  blueprint: Blueprint | null
  builtAgents: { id: number; name: string }[] | null
  createdAt: string
  discovery: DiscoveryChecklist | null
  discoveryProgress: DiscoveryProgress | null
  previewedInstructions: Record<
    string,
    { instructions: string; quality: InstructionsQuality; issues: string[] }
  >
}

// ── Mappers ───────────────────────────────────────────────────

function mapBlueprintAgent(a: ApiBlueprintAgent): BlueprintAgent {
  return {
    index: a.index,
    name: a.name,
    personaName: a.persona_name,
    roleType: a.role_type,
    description: a.description,
    tone: a.tone,
    skills: a.skills,
    triggers: a.triggers,
    why: a.why,
    estimatedMonthlyRuns: a.estimated_monthly_runs,
    channelDeploy: a.channel_deploy,
    status: a.status,
    builtAgentId: a.built_agent_id,
  }
}

export function mapBlueprint(b: ApiBlueprintResponse): Blueprint {
  return {
    agents: b.agents.map(mapBlueprintAgent),
    rationale: b.rationale,
    estimatedTimePerWeek: b.estimated_time_saved_per_week,
    coverageGaps: b.coverage_gaps,
  }
}

function mapDiscovery(d: ApiDiscovery | null | undefined): DiscoveryChecklist | null {
  if (!d) return null
  return {
    primaryGoal: d.primary_goal ?? null,
    audience: d.audience ?? null,
    autonomy: d.autonomy ?? null,
    topFailureModes: Array.isArray(d.top_failure_modes) ? d.top_failure_modes : [],
    escalationTriggers: Array.isArray(d.escalation_triggers) ? d.escalation_triggers : [],
    successMetric: d.success_metric ?? null,
    availableDataSources: Array.isArray(d.available_data_sources) ? d.available_data_sources : [],
  }
}

function mapDiscoveryProgress(
  p: ApiDiscoveryProgress | null | undefined,
): DiscoveryProgress | null {
  if (!p) return null
  return {
    filled: p.filled ?? 0,
    total: p.total ?? 7,
    readyToPropose: Boolean(p.ready_to_propose),
    missing: Array.isArray(p.missing) ? p.missing : [],
  }
}

function mapPreviewItem(item: ApiInstructionPreviewItem): InstructionPreviewItem {
  return {
    agentIndex: item.agent_index,
    agentName: item.agent_name,
    instructions: item.instructions,
    quality: item.quality === 'needs_review' ? 'needs_review' : 'ok',
    issues: Array.isArray(item.issues) ? item.issues : [],
  }
}

function mapArchitectResponse(r: ApiArchitectResponse): ArchitectResponse {
  return {
    message: r.message,
    stage: r.stage,
    blueprint: r.blueprint ? mapBlueprint(r.blueprint) : null,
    readyToBuild: r.ready_to_build,
    discovery: mapDiscovery(r.discovery),
    discoveryProgress: mapDiscoveryProgress(r.discovery_progress),
  }
}

function mapSessionDetail(s: ApiSessionDetail): SessionDetail {
  // Back-end returns previewed_instructions keyed by stringified index
  const previews: SessionDetail['previewedInstructions'] = {}
  if (s.previewed_instructions && typeof s.previewed_instructions === 'object') {
    for (const [key, val] of Object.entries(s.previewed_instructions)) {
      if (val && typeof val === 'object') {
        previews[key] = {
          instructions: val.instructions ?? '',
          quality: val.quality === 'needs_review' ? 'needs_review' : 'ok',
          issues: Array.isArray(val.issues) ? val.issues : [],
        }
      }
    }
  }
  return {
    sessionId: s.session_id,
    stage: s.stage,
    messages: s.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
    })),
    blueprint: s.blueprint ? mapBlueprint(s.blueprint) : null,
    builtAgents: s.built_agents ?? null,
    createdAt: s.created_at,
    discovery: mapDiscovery(s.discovery),
    discoveryProgress: mapDiscoveryProgress(s.discovery_progress),
    previewedInstructions: previews,
  }
}

// ── Service functions ─────────────────────────────────────────

export const agentBuilderService = {
  startSession: async (): Promise<{ sessionId: string; message: string; stage: string }> => {
    const r = await apiFetch<ApiStartSession>('/agent-builder/sessions', { method: 'POST' })
    return { sessionId: r.session_id, message: r.message, stage: r.stage }
  },

  sendMessage: async (sessionId: string, message: string): Promise<ArchitectResponse> => {
    const r = await apiFetch<ApiArchitectResponse>(
      `/agent-builder/sessions/${sessionId}/message`,
      { method: 'POST', body: JSON.stringify({ message }) },
    )
    return mapArchitectResponse(r)
  },

  approve: async (sessionId: string): Promise<BuildResponse> => {
    const r = await apiFetch<ApiBuildResponse>(
      `/agent-builder/sessions/${sessionId}/approve`,
      { method: 'POST' },
    )
    return { message: r.message, builtAgents: r.built_agents, stage: r.stage }
  },

  rejectAgent: async (sessionId: string, agentIndex: number): Promise<ArchitectResponse> => {
    const r = await apiFetch<ApiArchitectResponse>(
      `/agent-builder/sessions/${sessionId}/reject-agent`,
      { method: 'POST', body: JSON.stringify({ agent_index: agentIndex }) },
    )
    return mapArchitectResponse(r)
  },

  getSession: async (sessionId: string): Promise<SessionDetail> => {
    const r = await apiFetch<ApiSessionDetail>(`/agent-builder/sessions/${sessionId}`)
    return mapSessionDetail(r)
  },

  listSessions: async (): Promise<SessionDetail[]> => {
    const r = await apiFetch<ApiSessionDetail[]>('/agent-builder/sessions')
    return r.map(mapSessionDetail)
  },

  resetSession: async (sessionId: string): Promise<{ sessionId: string; message: string; stage: string }> => {
    const r = await apiFetch<ApiStartSession>(
      `/agent-builder/sessions/${sessionId}/reset`,
      { method: 'POST' },
    )
    return { sessionId: r.session_id, message: r.message, stage: r.stage }
  },

  /**
   * Phase-5 — render the instructions text the AI will be told for each
   * proposed agent, WITHOUT creating any agents. The owner reviews the
   * output in a drawer before clicking Approve.
   *
   * The previews are persisted on the session, so a follow-up /approve call
   * uses the EXACT text the owner saw (no surprise re-generation).
   */
  previewInstructions: async (sessionId: string): Promise<PreviewInstructionsResult> => {
    const r = await apiFetch<ApiPreviewInstructionsResponse>(
      `/agent-builder/sessions/${sessionId}/preview-instructions`,
      { method: 'POST' },
    )
    return {
      items: (r.items ?? []).map(mapPreviewItem),
      overallQuality: r.overall_quality === 'needs_review' ? 'needs_review' : 'ok',
    }
  },
}
