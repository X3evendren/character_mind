import { graphemes, safeText } from './text';

export interface Draft { text: string; cursor: number; }
export const emptyDraft = (): Draft => ({ text: '', cursor: 0 });
export function insertText(draft: Draft, input: string): Draft {
  const text = safeText(input);
  return { text: draft.text.slice(0, draft.cursor) + text + draft.text.slice(draft.cursor), cursor: draft.cursor + text.length };
}
export function editDraft(draft: Draft, action: 'left' | 'right' | 'backspace' | 'delete' | 'home' | 'end'): Draft {
  const before = draft.text.slice(0, draft.cursor), after = draft.text.slice(draft.cursor);
  const previous = graphemes(before).at(-1)?.length ?? 0, next = graphemes(after)[0]?.length ?? 0;
  switch (action) {
    case 'left': return { ...draft, cursor: draft.cursor - previous };
    case 'right': return { ...draft, cursor: draft.cursor + next };
    case 'backspace': return { text: before.slice(0, before.length - previous) + after, cursor: draft.cursor - previous };
    case 'delete': return { text: before + after.slice(next), cursor: draft.cursor };
    case 'home': return { ...draft, cursor: before.lastIndexOf('\n') + 1 };
    case 'end': return { ...draft, cursor: after.includes('\n') ? draft.cursor + after.indexOf('\n') : draft.text.length };
  }
}

/** Per-session history. Graph memory already persists dialogue; drafts need no second disk log. */
export class InputHistory {
  private entries: string[] = [];
  private index = 0;
  private savedDraft = '';
  add(text: string): void {
    if (this.entries.at(-1) !== text) this.entries = [...this.entries, text].slice(-100);
    this.reset();
  }
  reset(): void { this.index = this.entries.length; this.savedDraft = ''; }
  move(direction: -1 | 1, current: string): string {
    if (this.index === this.entries.length) this.savedDraft = current;
    this.index = Math.max(0, Math.min(this.entries.length, this.index + direction));
    return this.index === this.entries.length ? this.savedDraft : this.entries[this.index];
  }
}
