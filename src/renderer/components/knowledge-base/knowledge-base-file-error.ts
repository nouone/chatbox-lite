import { CHATBOX_AI_PARSER_LICENSE_KEY_REQUIRED_ERROR } from '@shared/file-parse-errors'
import {
  KNOWLEDGE_BASE_MAX_PARSED_CONTENT_SIZE_LABEL,
  KNOWLEDGE_BASE_PARSED_CONTENT_TOO_LARGE_ERROR,
} from '@shared/knowledge-base'
import { ChatboxAIAPIError } from '@shared/models/errors'
import type { KnowledgeBaseFile } from '@shared/types'

type KnowledgeBaseFileRetryState = Pick<KnowledgeBaseFile, 'error' | 'parsed_remotely'>
type ErrorTranslationOptions = { limit: string }
type ErrorTranslator = (key: string, options?: ErrorTranslationOptions) => string

export function isChatboxAIParserLicenseRequired(error: string | undefined): boolean {
  return error === CHATBOX_AI_PARSER_LICENSE_KEY_REQUIRED_ERROR
}

export function canRetryKnowledgeBaseFile(file: KnowledgeBaseFileRetryState): boolean {
  return file.error !== KNOWLEDGE_BASE_PARSED_CONTENT_TOO_LARGE_ERROR
}

export function getKnowledgeBaseFileErrorLabel(errorMessage: string, t: ErrorTranslator): string {
  if (errorMessage === KNOWLEDGE_BASE_PARSED_CONTENT_TOO_LARGE_ERROR) {
    return t('Parsed document content must be {{limit}} or smaller.', {
      limit: KNOWLEDGE_BASE_MAX_PARSED_CONTENT_SIZE_LABEL,
    })
  }

  if (errorMessage.startsWith('chatbox_ai_'))
    return t('The previous parser is unavailable. Retry using the configured document parser.')

  if (ChatboxAIAPIError.codeNameMap[errorMessage]) {
    return t(ChatboxAIAPIError.codeNameMap[errorMessage].i18nKey)
  }

  try {
    const jsonMatch = errorMessage.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const errorCode = parsed.error?.code

      if (errorCode && ChatboxAIAPIError.codeNameMap[errorCode]) {
        return t(ChatboxAIAPIError.codeNameMap[errorCode].i18nKey)
      }
      if (parsed.error?.detail) {
        return parsed.error.detail
      }
      if (parsed.error?.title) {
        return parsed.error.title
      }
    }
  } catch {
    // Render the original message when the response is not valid JSON.
  }
  return t(errorMessage)
}
