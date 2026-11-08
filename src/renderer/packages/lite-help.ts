import readme from '../../../README.md?raw'
import buildNotes from '../../../LOCAL-CUSTOM-BUILD.md?raw'
import apiGuide from '../../../LOCAL-CHAT-API.md?raw'
import servicesGuide from '../../../LOCAL-SERVICES.md?raw'
import phoneGuide from '../../../LOCAL-PHONE-ACCESS.md?raw'
import { ModelProviderEnum, createMessage } from '@shared/types'
import { rendererApplication } from '@/app/renderer-application'
import { initEmptyChatSession } from '@/stores/sessionHelpers'
import { switchCurrentSession } from '@/stores/session/crud'

/** Only bundled docs are included. No settings, keys, logs or other chats are attached. */
export async function openLiteHelpChat() {
  const draft = initEmptyChatSession()
  draft.name = 'Wao Help'
  if (draft.settings?.provider === ModelProviderEnum.ChatboxAI)
    draft.settings = { ...draft.settings, provider: undefined, modelId: undefined }
  draft.messages = [
    createMessage(
      'system',
      `Help the user use Wao based on the attached local documentation. Explain concrete steps. Do not claim to inspect or change their machine. If the docs do not cover an issue, say so. Never ask for API keys or passwords.\n\n[Attached: README.md]\n${readme}\n\n[Attached: LOCAL-CUSTOM-BUILD.md]\n${buildNotes}\n\n[Attached: LOCAL-CHAT-API.md]\n${apiGuide}\n\n[Attached: LOCAL-SERVICES.md]\n${servicesGuide}\n\n[Attached: LOCAL-PHONE-ACCESS.md]\n${phoneGuide}`
    ),
    createMessage(
      'assistant',
      'The Wao README and setup guide are attached as context. What would you like help with? Your configured chat model will answer when you send a question.'
    ),
  ]
  const session = await rendererApplication.sessions.createSession(draft)
  switchCurrentSession(session.id)
}
