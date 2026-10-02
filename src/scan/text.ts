// Text helpers shared by the scanners: offset to line and column, and HTML comment blanking.

export interface TextPosition {
  /** 1-based. */
  line: number;
  /** 1-based, in UTF-16 code units like editors and compilers report. */
  column: number;
}

export class LineIndex {
  private readonly starts: number[] = [0];

  constructor(text: string) {
    for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
      this.starts.push(index + 1);
    }
  }

  position(offset: number): TextPosition {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if ((this.starts[middle] ?? 0) <= offset) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: offset - (this.starts[low] ?? 0) + 1 };
  }
}

/** Replaces HTML comments with spaces, keeping line breaks so offsets stay valid. */
export function blankHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?(?:-->|$)/g, (comment) => comment.replace(/[^\n\r]/g, ' '));
}

/** First line of a message, shortened, for unscanned reasons. */
export function shortMessage(message: string, max = 160): string {
  const first = message.split(/\r?\n/, 1)[0] ?? '';
  return first.length > max ? `${first.slice(0, max - 3)}...` : first;
}
