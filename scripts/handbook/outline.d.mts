export interface Section { anchor: string; title: string; screenshot: string }
export interface OutlineChapter { part: string; title: string; file: string; ticket: string; device: string; sections: Section[] }
export interface IndexPart { title: string; chapters: { title: string; file: string }[] }
export function parseIndex(md: string): IndexPart[]
export function parseOutline(md: string): OutlineChapter[]
export function checkConsistency(parts: IndexPart[], chapters: OutlineChapter[]): string[]
