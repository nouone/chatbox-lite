import { expect, it } from 'vitest'
import { createWebChatPresentation } from './presentation'
it('uses the shared desktop Markdown parser for emphasis, lists, inline code, fenced code and tables', () => {
  const present = createWebChatPresentation()
  const result = present({
    status: 200,
    body: {
      id: 'a',
      messages: [
        {
          id: 'b',
          role: 'assistant',
          text: '**Bold**\n\n- Read `file.txt`\n- Next\n\n```js\nconst x = 1\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |',
        },
      ],
    },
  })
  const html = (result.body as { messages: { renderedHtml: string }[] }).messages[0].renderedHtml
  for (const tag of ['<strong>Bold</strong>', '<ul>', '<code>file.txt</code>', '<pre>', '<table>'])
    expect(html).toContain(tag)
})
it('does not execute model HTML, dangerous links, or automatically load remote images', () => {
  const result = createWebChatPresentation()({
    status: 200,
    body: {
      id: 'a',
      messages: [
        {
          id: 'b',
          role: 'assistant',
          text: '<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![example](https://example.com/track.png)',
        },
      ],
    },
  })
  const html = (result.body as { messages: { renderedHtml: string }[] }).messages[0].renderedHtml
  expect(html).not.toContain('<script>')
  expect(html).not.toContain('href="javascript:')
  expect(html).not.toContain('<img')
  expect(html).toContain('Image: example')
})
