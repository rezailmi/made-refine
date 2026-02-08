export interface ReactComponentFrame {
  name: string
  file?: string
  line?: number
  column?: number
}

export interface VisualEditElement {
  tagName: string
  id: string | null
  classList: string[]
  domSelector: string
  targetHtml: string
  textPreview: string
}

export interface SourceLocation {
  file: string
  line?: number
  column?: number
}

export interface CSSChange {
  cssProperty: string
  cssValue: string
  tailwindClass: string
}

export interface VisualEdit {
  id: string
  timestamp: number
  status: 'pending' | 'acknowledged' | 'applied' | 'dismissed'
  type: 'edit'
  element: VisualEditElement
  source: SourceLocation | null
  reactStack: ReactComponentFrame[]
  changes: CSSChange[]
  exportMarkdown: string
}

export interface VisualComment {
  id: string
  timestamp: number
  status: 'pending' | 'acknowledged' | 'applied' | 'dismissed'
  type: 'comment'
  element: VisualEditElement
  source: SourceLocation | null
  reactStack: ReactComponentFrame[]
  commentText: string
  replies: Array<{ text: string; createdAt: number }>
  exportMarkdown: string
}

export type VisualAnnotation = VisualEdit | VisualComment
