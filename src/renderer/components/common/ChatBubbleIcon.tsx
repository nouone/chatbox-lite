import type { IconProps } from '@tabler/icons-react'
import { forwardRef } from 'react'

// Same outer shape as Tabler's MIT-licensed MessageChatbot, with no face.
export const ChatBubbleIcon = forwardRef<SVGSVGElement, IconProps>(
  ({ size = 24, color = 'currentColor', stroke = 2, strokeWidth, ...props }, ref) => (
    <svg
      {...props}
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth ?? stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12" />
    </svg>
  )
)
ChatBubbleIcon.displayName = 'ChatBubbleIcon'
