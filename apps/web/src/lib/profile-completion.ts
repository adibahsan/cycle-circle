export interface CompletionItem {
  key: string
  done: boolean
}

export interface ProfileCompletionStatus {
  percent: number
  complete: boolean
  items: CompletionItem[]
}
