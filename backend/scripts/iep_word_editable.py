"""Flowing Word forms: real table cells and paragraphs, with no page canvas.

The source geometry identifies cells and labels only. Word owns line wrapping,
row heights and pagination, so editing a telephone number never selects a shape.
"""
import base64
import copy
import io
import re
import statistics
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt
import iep_word as w


def _paragraph(text='', *, size=11, color='000000', bold=False, center=False, keep=False):
    p = w.paragraph(text, size=size, color=color, bold=bold, center=center, keep=keep)
    p.find('w:pPr', w.NS).append(w.el('snapToGrid', val=0))
    spacing = p.find('w:pPr/w:spacing', w.NS)
    spacing.set(w.qn('w:after'), '35')
    # A minimum, rather than an exact line height, keeps the reference's form
    # density while allowing larger text or an inline picture to raise the line.
    spacing.set(w.qn('w:line'), '280')
    spacing.set(w.qn('w:lineRule'), 'atLeast')
    return p


def _prepare(page, geometry):
    blocks = copy.deepcopy(geometry['blocks'])
    containers = []
    for block in blocks:
        if block['kind'] == 'table':
            for cell in block['cells']:
                cell['heading'] = abs(cell['box'][1] - block['top']) < 1
            containers.extend(block['cells'])
        else:
            containers.append(block)
    for container in containers:
        container['fields'] = []
        container['images'] = []
        container['source'] = page['source']
        chars = []
        for original in container['chars']:
            c = copy.copy(original)
            x, y = (c['x0'] + c['x1']) / 2, (c['top'] + c['bottom']) / 2
            if any(w.inside(x, y, w.boxxy(field['box'])) for field in page['fields']):
                continue
            if c['text'] in ['□', '☐'] and any(abs(check['x'] - c['x0']) < 9 and abs(check['y'] - c['top']) < 9 for check in page['checks']):
                c['text'] = '☑'
            chars.append(c)
        container['chars'] = chars
    cells = [cell for block in blocks if block['kind'] == 'table' for cell in block['cells']]
    outside = [block for block in blocks if block['kind'] != 'table']

    def target(box):
        x, y, width, height = box
        candidates = [cell for cell in cells if w.inside(x + width / 2, y + height / 2, cell['box'])]
        if candidates:
            return min(candidates, key=lambda cell: (cell['box'][2] - cell['box'][0]) * (cell['box'][3] - cell['box'][1]))
        lines = [block for block in outside if y - 5 <= block['top'] <= y + height + 3]
        return min(lines, key=lambda block: abs(block['top'] - y)) if lines else None

    for field in page['fields']:
        container = target(field['box'])
        if container is None:
            x, y, width, height = field['box']
            container = dict(kind='text', top=y, box=[x, y, x + width, y + height], chars=[], fields=[], images=[])
            blocks.append(container)
        container['fields'].append(field)
    for image in page['images']:
        container = target(image['box'])
        if container is None:
            x, y, width, height = image['box']
            container = dict(kind='text', top=y, box=[x, y, x + width, y + height], chars=[], fields=[], images=[])
            blocks.append(container)
        container['images'].append(image)
    return sorted(blocks, key=lambda block: block['top'])


def _contents(container):
    entries = []
    for top, chars in w.char_lines(container['chars']):
        chunks = []
        for char in sorted(chars, key=lambda c: c['x0']):
            if not chunks or char['x0'] - chunks[-1][-1]['x1'] > 2.5:
                chunks.append([])
            chunks[-1].append(char)
        for chunk in chunks:
            value = ''.join(c['text'] for c in chunk).strip()
            if value:
                original_size = statistics.median(c['size'] for c in chunk)
                outside = container.get('kind') == 'text'
                title = outside and (original_size >= 18 or container['box'][1] < 75 and original_size >= 13)
                size = (16 if original_size >= 18 else 14) if title else 11
                if container.get('source') == 1 and outside and 150 <= container['box'][1] < 500:
                    size = 12
                if container.get('source') == 1 and outside and container['box'][1] > 700:
                    size = 10
                entries.append(dict(top=top, x=chunk[0]['x0'], text=value,
                                    size=size, color=w.color_of(chunk), bold=title or container.get('heading', False), is_heading=title))
    for field in container['fields']:
        entries.append(dict(top=field['box'][1], x=field['box'][0], text=field['value'],
                            size=max(11, (field.get('style') or {}).get('size', 11)), color='000000', bold=False,
                            center=(field.get('style') or {}).get('align') == 'center'))
    groups = []
    for entry in sorted(entries, key=lambda item: (round(item['top'] / 4), item['x'])):
        if groups and abs(entry['top'] - groups[-1][0]['top']) < 4:
            groups[-1].append(entry)
        else:
            groups.append([entry])
    result = []
    for group in groups:
        # Values stay in the same paragraph as their labels. Line breaks inside
        # a value remain ordinary Word line breaks, never independent text boxes.
        paragraph = _paragraph(center=len(group) == 1 and group[0].get('center', False), keep=any(entry.get('is_heading') for entry in group))
        for run in list(paragraph.findall('w:r', w.NS)):
            paragraph.remove(run)
        for index, entry in enumerate(sorted(group, key=lambda entry: entry['x'])):
            value = ('　' if index else '') + entry['text']
            styled = w.paragraph(value, size=entry['size'], color=entry['color'], bold=entry['bold'])
            for run in list(styled.findall('w:r', w.NS)):
                paragraph.append(run)
        result.append(paragraph)
    if container.get('source') in (12, 16) and not container['fields']:
        # PDF line endings inside the printed instruction tables are visual
        # wraps, not separate Word paragraphs. Preserve list boundaries while
        # allowing continuation text to wrap naturally in its original column.
        flowing = []
        for paragraph in result:
            text = ''.join(paragraph.xpath('.//w:t/text()'))
            starts_item = re.match(r'^(?:[□☐☑○◎●•]|[（(]?[0-9一二三四五六七八九十A-C]+[.、）)])', text.lstrip())
            if flowing and not starts_item:
                for run in list(paragraph.findall('w:r', w.NS)):
                    flowing[-1].append(run)
            else:
                flowing.append(paragraph)
        result = flowing
    return result


def _append_images(parent, container, document, maximum_width):
    from docx.text.paragraph import Paragraph
    from docx.image.image import Image
    for image in container['images']:
        raw = base64.b64decode(image['base64'])
        p = _paragraph()
        parent.append(p)
        info = Image.from_blob(raw)
        scale = min(maximum_width / info.px_width, image['box'][2] / info.px_width, image['box'][3] / info.px_height)
        Paragraph(p, document._body).add_run().add_picture(io.BytesIO(raw), width=Pt(info.px_width * scale), height=Pt(info.px_height * scale))


def _table(block, document):
    xs, ys, cells = block['xs'], block['ys'], block['cells']
    widths = [right - left for left, right in zip(xs, xs[1:])]
    cover = bool(cells and cells[0].get('source') == 1)
    table = w.el('tbl')
    pr = w.el('tblPr'); table.append(pr)
    pr.append(w.el('tblW', w=round((xs[-1] - xs[0]) * 20), type='dxa'))
    pr.append(w.el('tblInd', w=max(0, round((xs[0] - 28) * 20)), type='dxa'))
    pr.append(w.el('tblLayout', type='fixed'))
    borders = w.el('tblBorders'); pr.append(borders)
    for edge in ['top', 'bottom', 'left', 'right', 'insideH', 'insideV']:
        borders.append(w.el(edge, val='single', sz=5, color='000000'))
    margins = w.el('tblCellMar'); pr.append(margins)
    padding = [('top', 10), ('bottom', 10), ('left', 40), ('right', 40)] if cover else [('top', 45), ('bottom', 45), ('left', 55), ('right', 55)]
    for edge, value in padding:
        margins.append(w.el(edge, w=value, type='dxa'))
    grid = w.el('tblGrid'); table.append(grid)
    for width in widths:
        grid.append(w.el('gridCol', w=round(width * 20)))
    for ri, (top, bottom) in enumerate(zip(ys, ys[1:])):
        row = w.el('tr'); table.append(row)
        # Source rows provide minimum writing space, never a clipping ceiling.
        # No exact row heights or cantSplit: long content can expand and flow.
        rp = w.el('trPr'); row.append(rp)
        rp.append(w.el('trHeight', val=max(1, round((bottom - top) * 20)), hRule='atLeast'))
        if ri == 0 and not any(c['box'][1] <= top + 1 and c['box'][3] > bottom + 1 for c in cells):
            rp.append(w.el('tblHeader'))
        ci = 0
        while ci < len(xs) - 1:
            x, y = (xs[ci] + xs[ci + 1]) / 2, (top + bottom) / 2
            cell = next((c for c in cells if w.inside(x, y, c['box'])), None)
            end = ci + 1
            if cell:
                while end < len(xs) - 1 and xs[end] < cell['box'][2] - .8:
                    end += 1
            tc = w.el('tc'); row.append(tc); cp = w.el('tcPr'); tc.append(cp)
            cp.append(w.el('tcW', w=round(sum(widths[ci:end]) * 20), type='dxa'))
            if end - ci > 1:
                cp.append(w.el('gridSpan', val=end - ci))
            first = cell is not None and abs(cell['box'][1] - top) < 1
            if cell and cell['box'][3] - cell['box'][1] > bottom - top + 1:
                cp.append(w.el('vMerge', val='restart' if first else 'continue'))
            cp.append(w.el('vAlign', val='center'))
            nodes = _contents(cell) if first else []
            if cover:
                for paragraph in nodes:
                    paragraph.find('w:pPr/w:spacing', w.NS).set(w.qn('w:after'), '0')
            for node in nodes:
                tc.append(node)
            if not nodes:
                tc.append(_paragraph())
            if first:
                _append_images(tc, cell, document, sum(widths[ci:end]) - 6)
            ci = end
    return table


def fill(model, output, geometry):
    document = Document()
    section = document.sections[0]
    section.page_width, section.page_height = Pt(595.32), Pt(841.92)
    section.left_margin = section.right_margin = Pt(28)
    section.top_margin, section.bottom_margin = Pt(35), Pt(40)
    section.footer_distance = Pt(18)
    for grid in section._sectPr.findall(w.qn('w:docGrid')):
        section._sectPr.remove(grid)
    normal = document.styles['Normal']
    normal.font.name, normal.font.size = '標楷體', Pt(11)
    normal_fonts = normal._element.get_or_add_rPr().get_or_add_rFonts()
    for name, value in [('ascii', 'Times New Roman'), ('hAnsi', 'Times New Roman'), ('eastAsia', '標楷體')]:
        normal_fonts.set(w.qn('w:' + name), value)
    footer = section.footer.paragraphs[0]; footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer.add_run(); run.font.size = Pt(9)
    run._r.append(w.el('fldChar', fldCharType='begin'))
    instruction = w.el('instrText'); instruction.text = 'PAGE'; run._r.append(instruction)
    run._r.append(w.el('fldChar', fldCharType='end'))
    body = document._element.body
    sect = body.find(w.qn('w:sectPr'))
    by_source = {page['source']: page for page in geometry}
    for index, page in enumerate(model['pages']):
        previous = model['pages'][index - 1] if index else None
        new_section = bool(previous and (page['section'] != previous['section'] or page['source'] == previous['source'] and page['source'] in (11, 13, 14, 19, 20)))
        first_node = True
        for block in _prepare(page, by_source[page['source']]):
            if block['kind'] == 'table':
                if first_node:
                    heading = _paragraph(page['section'], size=14, bold=True, keep=True)
                    if new_section:
                        heading.find('w:pPr', w.NS).append(w.el('pageBreakBefore'))
                    body.insert(body.index(sect), heading); first_node = False
                body.insert(body.index(sect), _table(block, document))
            else:
                for paragraph in _contents(block):
                    if first_node and new_section:
                        paragraph.find('w:pPr', w.NS).append(w.el('pageBreakBefore'))
                    body.insert(body.index(sect), paragraph); first_node = False
                if block['images']:
                    holder = w.el('sdtContent')
                    _append_images(holder, block, document, 530)
                    for paragraph in list(holder):
                        if first_node and new_section:
                            paragraph.find('w:pPr', w.NS).append(w.el('pageBreakBefore'))
                        body.insert(body.index(sect), paragraph); first_node = False
        field_values = {field['value'] for field in page['fields']}
        notes = []
        for note in page['notes']:
            if note['text'] not in field_values and note not in notes:
                notes.append(note)
        if notes and page['source'] == 1:
            if len({note['title'] for note in notes}) == 1:
                text = notes[0]['title'] + '：' + '；'.join(note['text'] for note in notes)
            else:
                text = '；'.join(note['title'] + '：' + note['text'] for note in notes)
            body.insert(body.index(sect), _paragraph(text))
        elif notes:
            if len(notes) > 3 or sum(len(note['text']) for note in notes) > 500:
                body.insert(body.index(sect), _paragraph(page['section'] + '補充資料', size=12, bold=True, keep=True))
            for note in notes:
                body.insert(body.index(sect), _paragraph(note['title'] + '：' + note['text']))
    document.core_properties.title = f'{model["studentName"]} {model["academicYear"]}學年度 個別化教育計畫'
    document.core_properties.author = 'EyeEP'
    document.save(output)
