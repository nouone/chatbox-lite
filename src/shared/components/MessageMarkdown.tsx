import { sanitizeUrl } from '@braintree/sanitize-url'
import type { ComponentProps } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

/** Shared parsing rules for desktop messages and the small browser continuation view. */
export function messageRemarkPlugins(math = false): NonNullable<ComponentProps<typeof ReactMarkdown>['remarkPlugins']> {
  return math ? [remarkGfm, remarkMath, remarkBreaks] : [remarkGfm, remarkBreaks]
}

type Props = ComponentProps<typeof ReactMarkdown> & { browserView?: boolean }

export function MessageMarkdown({ browserView = false, remarkPlugins, components, className, ...props }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins ?? messageRemarkPlugins()}
      className={`cbl-message-markdown ${className ?? ''}`}
      {...(browserView
        ? {
            // The web page never auto-loads model-provided images or runs embedded HTML/artifacts.
            urlTransform: (url: string) => {
              const safe = sanitizeUrl(url)
              return /^(https?:|mailto:|#|\/)/i.test(safe) ? safe : ''
            },
            components: {
              a: ({ href, children }) =>
                href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ) : (
                  <span>{children}</span>
                ),
              img: ({ alt }) => (
                <span className="image-placeholder">{alt ? `Image: ${alt}` : 'Image — open in Desktop'}</span>
              ),
            },
          }
        : {})}
      {...props}
      {...(components ? { components } : {})}
    />
  )
}
