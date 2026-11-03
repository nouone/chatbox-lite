import { describe, expect, test, vi } from 'vitest'
import {
  canRetryKnowledgeBaseFile,
  getKnowledgeBaseFileErrorLabel,
  isChatboxAIParserLicenseRequired,
} from './knowledge-base-file-error'

describe('knowledge base file error policy', () => {
  test('allows a configured-parser retry for a legacy license error', () => {
    const error = 'chatbox_ai_parser_license_key_required'

    expect(isChatboxAIParserLicenseRequired(error)).toBe(true)
    expect(canRetryKnowledgeBaseFile({ error, parsed_remotely: 1 })).toBe(true)
  })

  test('allows retrying a remote failure with the configured parser', () => {
    expect(canRetryKnowledgeBaseFile({ error: 'chatbox_ai_parser_failed', parsed_remotely: 1 })).toBe(true)
  })

  test('formats parsed-content limits instead of exposing the internal error code', () => {
    const t = vi.fn((key: string, options?: { limit: string }) => (options?.limit ? `${key} ${options.limit}` : key))

    expect(getKnowledgeBaseFileErrorLabel('knowledge_base_parsed_content_too_large', t)).toBe(
      'Parsed document content must be {{limit}} or smaller. 20 MB'
    )
  })
})
