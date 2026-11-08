import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Alert, Stack, Text } from '@mantine/core'
import {
  LOCAL_PARSER_FILE_TOO_LARGE_ERROR,
  LOCAL_PARSER_MAX_PDF_FILE_SIZE_LABEL,
  LOCAL_PARSER_PDF_PASSWORD_PROTECTED_ERROR,
} from '@shared/file-parse-errors'
import { IconAlertCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { navigateToSettings } from '@/modals/settings-navigation'
import {
  isSessionAttachmentRagAuthError,
  isSessionAttachmentRagIndexingError,
  SESSION_ATTACHMENT_RAG_PARSED_CONTENT_TOO_LARGE_ERROR,
  SESSION_ATTACHMENT_RAG_REQUIRES_KNOWLEDGE_BASE_ERROR,
  SESSION_ATTACHMENT_RAG_REQUIRES_TOOL_USE_MODEL_ERROR,
} from '@/stores/sessionAttachmentRagErrors'

interface FileParseErrorProps {
  errorCode: string
  fileName?: string
}

const FileParseError = NiceModal.create(({ errorCode, fileName }: FileParseErrorProps) => {
  const modal = useModal()
  const { t } = useTranslation()

  const onClose = () => {
    modal.resolve()
    modal.hide()
  }

  // 根据错误码和平台能力获取错误文案

  // 错误提示内容
  const renderErrorTips = () => {
    if (errorCode === LOCAL_PARSER_PDF_PASSWORD_PROTECTED_ERROR) {
      return (
        <Text>
          {t('This PDF is password-protected, so its content cannot be read. Remove the password and upload it again.')}
        </Text>
      )
    }
    if (errorCode === LOCAL_PARSER_FILE_TOO_LARGE_ERROR) {
      return (
        <Text>
          {t('This PDF is too large to process (max {{size}}). Please upload a smaller file.', {
            size: LOCAL_PARSER_MAX_PDF_FILE_SIZE_LABEL,
          })}
        </Text>
      )
    }
    if (isSessionAttachmentRagAuthError(errorCode)) {
      return (
        <Text>
          {t(
            'The document indexing service is unavailable. Check your configured models or upload a smaller searchable document.'
          )}
        </Text>
      )
    }
    if (isSessionAttachmentRagIndexingError(errorCode)) {
      return <Text>{`${t('Indexing failed')}. ${t('Continue')}`}</Text>
    }
    if (errorCode === SESSION_ATTACHMENT_RAG_REQUIRES_KNOWLEDGE_BASE_ERROR) {
      return (
        <Text>
          {t('This attachment is too large for chat attachments. Please upload it through Knowledge Base instead.')}
        </Text>
      )
    }
    if (errorCode === SESSION_ATTACHMENT_RAG_PARSED_CONTENT_TOO_LARGE_ERROR) {
      return (
        <Text>
          {t(
            'This document contains too much text for chat attachments. Please upload it through Knowledge Base instead.'
          )}
        </Text>
      )
    }
    if (errorCode === SESSION_ATTACHMENT_RAG_REQUIRES_TOOL_USE_MODEL_ERROR) {
      return (
        <Text>
          {t(
            'Large file Q&A requires a model with tool use support. Switch to a compatible model or remove this file.'
          )}
        </Text>
      )
    }

    return (
      <Stack gap="sm">
        <Text>
          {t(
            'Could not extract text from this file. Try a text file or searchable PDF, or check your configured document parser.'
          )}
        </Text>
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 underline"
          onClick={() => {
            onClose()
            navigateToSettings('/document-parser')
          }}
        >
          {t('Document Parser settings')}
        </button>
      </Stack>
    )
  }

  return (
    <AdaptiveModal opened={modal.visible} onClose={onClose} size="md" centered title={t('File Processing Error')}>
      <Stack gap="md">
        {fileName && (
          <Text size="sm" c="chatbox-secondary">
            {t('File')}: {fileName}
          </Text>
        )}

        <Alert icon={<ScalableIcon size={20} icon={IconAlertCircle} />} color="orange" variant="light">
          {renderErrorTips()}
        </Alert>

        <AdaptiveModal.Actions>
          <AdaptiveModal.CloseButton onClick={onClose} />
        </AdaptiveModal.Actions>
      </Stack>
    </AdaptiveModal>
  )
})

export default FileParseError
