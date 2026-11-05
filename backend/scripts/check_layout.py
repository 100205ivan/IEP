"""Check an exported IEP PDF for layout problems a reader would notice.

Runs after every PDF export. Squeezed text is reported only when it belongs to
a value filled into the form, so labels the official form prints vertically
are never flagged. Prints a JSON report; optionally saves one PNG per page.

    python check_layout.py --pdf export.pdf --values values.json [--unplaced N] [--png-dir DIR]
"""
import argparse
import json
import re
import sys
from pathlib import Path
import pdfplumber

STACK_LINES = 4        # a value printing at most STACK_WIDTH characters per line for this many lines
STACK_WIDTH = 2
NEAR_EMPTY_CHARS = 25  # a page with less text is likely a spilled line or two
FORBIDDEN = {'☑': '字型缺字的勾選符號 ☑', '☐': '字型缺字的方框 ☐', '國-J-A2': '原表單的範例答案'}
compact = lambda text: re.sub(r'\s+', '', text)


def lines_of(page):
    lines = {}
    for ch in page.chars:
        if ch['text'].strip():
            lines.setdefault(round(ch['top']), []).append(ch)
    return [sorted(chars, key=lambda c: c['x0']) for _, chars in sorted(lines.items())]


def chunks(chars):
    """Groups of touching characters on one line, i.e. one cell's text."""
    groups = []
    for ch in chars:
        if groups and ch['x0'] - groups[-1][-1]['x1'] < ch['size'] * 0.6:
            groups[-1].append(ch)
        else:
            groups.append([ch])
    return groups


def stacks(page):
    """Runs of lines whose text at the same x is at most STACK_WIDTH
    characters: text squeezed into a column one or two characters wide."""
    narrow = [dict(x=g[0]['x0'], top=g[0]['top'], size=g[0]['size'], text=''.join(c['text'] for c in g))
              for chars in lines_of(page) for g in chunks(chars) if len(g) <= STACK_WIDTH]
    found, run = [], []
    for item in sorted(narrow, key=lambda c: (round(c['x']), c['top'])):
        if run and abs(run[-1]['x'] - item['x']) < 3 and 0 < item['top'] - run[-1]['top'] < run[-1]['size'] * 2.2:
            run.append(item)
            continue
        if len(run) >= STACK_LINES:
            found.append(run)
        run = [item]
    if len(run) >= STACK_LINES:
        found.append(run)
    return [[item['text'] for item in r] for r in found]


def squeezed_value(lines, values):
    """The longest stretch of at least STACK_LINES lines that is part of a
    filled value; a column heading above it, such as 標準, is not."""
    for size in range(len(lines), STACK_LINES - 1, -1):
        for start in range(len(lines) - size + 1):
            text = ''.join(lines[start:start + size])
            if any(text in value for value in values):
                return text
    return None


def check(pdf_path, values, unplaced=0):
    values = [compact(value) for value in values if len(compact(value)) >= STACK_LINES]
    issues = []
    with pdfplumber.open(pdf_path) as pdf:
        pages = len(pdf.pages)
        for number, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            for stack in stacks(page):
                squeezed = squeezed_value(stack, values)
                if squeezed:
                    issues.append(dict(level='error', page=number, kind='文字擠成直排', detail=f'「{squeezed[:16]}」所在的格子太窄，每行只排得下一兩個字'))
            outside = ''.join(c['text'] for c in page.chars if c['text'].strip() and (c['x0'] < 0 or c['x1'] > page.width or c['bottom'] > page.height))
            if outside:
                issues.append(dict(level='error', page=number, kind='超出頁面', detail=f'「{outside[:20]}」超出紙張範圍'))
            count = sum(1 for c in page.chars if c['text'].strip())
            if count < NEAR_EMPTY_CHARS:
                issues.append(dict(level='warning', page=number, kind='幾乎空白', detail=f'只有 {count} 個字，可能是前一頁溢出的一兩行'))
            for needle, meaning in FORBIDDEN.items():
                if needle in text:
                    issues.append(dict(level='error', page=number, kind='不該出現的內容', detail=meaning))
    if unplaced:
        issues.append(dict(level='warning', page=None, kind='未放入表單', detail=f'{unplaced} 個欄位沒有對應位置，已改列在補充資料'))
    return dict(pages=pages, unplaced=unplaced, issues=issues)


def render(pdf_path, folder):
    import pypdfium2 as pdfium
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob('*.png'):
        old.unlink()
    pdf = pdfium.PdfDocument(str(pdf_path))
    for index in range(len(pdf)):
        pdf[index].render(scale=1.3).to_pil().save(folder / f'p{index + 1:02d}.png')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', required=True)
    parser.add_argument('--values', help='JSON list of the values filled into the form')
    parser.add_argument('--unplaced', type=int, default=0)
    parser.add_argument('--png-dir')
    args = parser.parse_args()
    values = json.loads(Path(args.values).read_text(encoding='utf-8')) if args.values else []
    report = check(args.pdf, values, args.unplaced)
    if args.png_dir:
        render(args.pdf, args.png_dir)
        report['pngFolder'] = str(Path(args.png_dir))
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    sys.exit(main())
