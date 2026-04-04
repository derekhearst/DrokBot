import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('text', plaintext)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('svelte', xml)

const marked = new Marked(
	markedHighlight({
		langPrefix: 'hljs language-',
		emptyLangClass: 'hljs language-plaintext',
		highlight(code, language) {
			const normalizedLanguage = language?.trim().toLowerCase() ?? 'plaintext'

			if (hljs.getLanguage(normalizedLanguage)) {
				return hljs.highlight(code, { language: normalizedLanguage }).value
			}

			return hljs.highlight(code, { language: 'plaintext' }).value
		},
	}),
)

marked.setOptions({
	gfm: true,
	breaks: true,
})

export function renderMarkdown(content: string) {
	return marked.parse(content ?? '') as string
}
