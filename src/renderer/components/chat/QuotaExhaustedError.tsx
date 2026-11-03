import type { ChatboxAIPlanType, Message } from '@shared/types'
import type { MessageErrorPresentation } from './message-error-presentation'

/** Show a provider error without selling a vendor subscription. */
export function QuotaExhaustedError(_props: {
  msg: Message
  sessionId?: string
  licensePlan?: ChatboxAIPlanType
  presentation: Extract<MessageErrorPresentation, { kind: 'quota' }>
}) {
  return (
    <div role="alert">The provider reported a quota limit. Check its limits or choose another configured model.</div>
  )
}
