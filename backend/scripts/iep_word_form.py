"""Fill the official blank IEP Word form with the export model.

The model's fields and checks are positioned on the cleaned reference PDF.
Both the PDF geometry and the Word form contain the same printed labels, so
their text is aligned character by character. A field is then written next
to, or in place of, the Word text that matches the PDF text around its box.
Everything the form cannot place is kept as a supplement paragraph.
"""
import base64
import copy
import difflib
import io
import re
import sys
import unicodedata
from pathlib import Path
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt
from docx.text.paragraph import Paragraph

FORM = Path(__file__).resolve().parents[1] / 'assets' / 'iep-form-template.docx'
W_P, W_R, W_T, W_TC, W_TR, W_RPR = qn('w:p'), qn('w:r'), qn('w:t'), qn('w:tc'), qn('w:tr'), qn('w:rPr')
MC_FALLBACK = '{http://schemas.openxmlformats.org/markup-compatibility/2006}Fallback'
XML_SPACE = '{http://www.w3.org/XML/1998/namespace}space'
BLANK = set(' 　_＿ ')
CHECKED = '■'

# Body elements of iep-form-template.docx holding each reference PDF page,
# as inclusive element ranges or (table element, first row, end row) slices.
# The annual goal rows (page 13) and semester goal rows (page 14) share one
# Word table and are cut apart so each domain or semester repeats on its own.
PARTS = {
    1: [(0, 12)], 2: [(13, 16)], 3: [(17, 29)], 4: [(30, 36)], 5: [(37, 40)],
    6: [(41, 44)], 7: [(45, 50)], 8: [(51, 57)], 9: [(58, 63)], 10: [(64, 68)],
    11: [(69, 77)], 12: [(78, 80)], 13: [(81, 82), (83, 0, 5)],
    14: [(83, 5, None), (84, 94)], 15: [(95, 103)], 16: [(104, 106)],
    17: [(107, 113)], 18: [(114, 120)], 19: [(121, 124)], 20: [(125, 128)],
}
GOALS_TABLE, FINAL_ELEMENT = 83, 129
TAB_STOP = 720  # w:defaultTabStop of the form, in twips
# A further domain continues chapter 參 without repeating its numbered
# heading, which would advance the 壹、貳、參 chapter numbering.
REPEAT_SKIP = {13: {81}}


def _norm(ch):
    # One character in, one out: expansions such as ㈠ → (一) would shift
    # every later position of the alignment.
    folded = unicodedata.normalize('NFKC', ch)
    ch = folded if len(folded) == 1 else ch
    return '□' if ch in '☐■☑' else ch


def _blank(text):
    return bool(text) and all(ch in BLANK or ch.isspace() for ch in text)


def _in_fallback(node):
    return any(ancestor.tag == MC_FALLBACK for ancestor in node.iterancestors())


def _texts(element):
    return [t for t in element.iter(W_T) if not _in_fallback(t)]


def _run_text(run):
    return ''.join(t.text or '' for t in run.findall(W_T))


def _writing_line(run):
    """An underlined blank (tab, spaces or underscores) printed for handwriting."""
    if run is None or run.tag != W_R:
        return False
    content = [child for child in run if child.tag != W_RPR]
    if not content or any(child.tag not in (W_T, qn('w:tab')) for child in content):
        return False
    text = _run_text(run)
    if text and not _blank(text):
        return False
    return _underlined(run) or any(ch in '_＿' for ch in text)


def _clear_cell(tc):
    paragraphs = tc.findall(W_P)
    for extra in paragraphs[1:]:
        tc.remove(extra)
    for child in list(paragraphs[0]):
        if child.tag != qn('w:pPr'):
            paragraphs[0].remove(child)


FORM_FONT = '標楷體'  # the reference PDF prints the whole form in 標楷體


def _use_form_font(root):
    """Map the blank form's Chinese fonts (細明體_HKSCS, 微軟正黑體) to 標楷體,
    as printed in the reference PDF. Latin fonts such as Times New Roman stay."""
    for fonts in root.iter(qn('w:rFonts')):
        fonts.attrib.pop(qn('w:eastAsiaTheme'), None)
        fonts.set(qn('w:eastAsia'), FORM_FONT)
        for slot in ('w:ascii', 'w:hAnsi', 'w:cs'):
            name = fonts.get(qn(slot))
            if name and not name.isascii():
                fonts.set(qn(slot), FORM_FONT)


# Elements that follow w:hideSpellingErrors in the w:settings sequence.
SETTINGS_AFTER_PROOFING = ['w:activeWritingStyle', 'w:proofState', 'w:formsDesign', 'w:attachedTemplate', 'w:linkStyles',
                           'w:stylePaneFormatFilter', 'w:stylePaneSortMethod', 'w:documentType', 'w:mailMerge', 'w:revisionView',
                           'w:trackRevisions', 'w:doNotTrackMoves', 'w:doNotTrackFormatting', 'w:documentProtection',
                           'w:autoFormatOverride', 'w:styleLockTheme', 'w:styleLockQFSet', 'w:defaultTabStop']


def _hide_proofing_marks(settings):
    """Form wording such as 特需領域 or 九年國教 is not a spelling error; keep
    Word's red and blue wavy underlines off the printed form."""
    following = next((child for child in settings if child.tag in {qn(tag) for tag in SETTINGS_AFTER_PROOFING}), None)
    for tag in ('w:hideSpellingErrors', 'w:hideGrammaticalErrors'):
        if settings.find(qn(tag)) is None:
            mark = OxmlElement(tag)
            if following is not None:
                following.addprevious(mark)
            else:
                settings.append(mark)


def build_form_template(source, target=FORM):
    """Remove the sample answers left in the goals table of the blank form and
    print it in the reference PDF's 標楷體."""
    document = Document(source)
    for root in (document.element, document.styles.element, document.part.numbering_part.element):
        _use_form_font(root)
    _hide_proofing_marks(document.settings.element)
    table = document.element.body[GOALS_TABLE]
    rows = table.findall(W_TR)
    for row in rows[1:]:
        cells = row.findall(W_TC)
        labels = [''.join(t.text or '' for t in cell.iter(W_T)) for cell in cells]
        if '第一學期目標' in labels:
            break
        nested = labels[0] == '' or any(label in ('學習表現', '學習內容') for label in labels[:2])
        for cell in cells[2 if nested else 1:]:
            _clear_cell(cell)
        if all(''.join(t.text or '' for t in cell.iter(W_T)) == '' for cell in cells):
            table.remove(row)
    rows = table.findall(W_TR)
    semester = next(i for i, row in enumerate(rows) if '第一學期目標' in ''.join(t.text or '' for t in row.iter(W_T)))
    for row in rows[semester + 2:]:
        for cell in row.findall(W_TC):
            _clear_cell(cell)
    properties = document.core_properties
    properties.author = properties.last_modified_by = 'EyeEP'
    properties.title = 'IEP個別化教育計畫'
    document.save(target)


def _explode(element):
    """Give every character its own run, so edits never move another locator."""
    for run in list(element.iter(W_R)):
        if _in_fallback(run):
            continue
        children = [child for child in run if child.tag != W_RPR]
        if len(children) <= 1 and all(child.tag != W_T or len(child.text or '') <= 1 for child in children):
            continue
        properties = run.find(W_RPR)
        pieces = []
        for child in children:
            if child.tag == W_T and len(child.text or '') > 1:
                for ch in child.text:
                    piece = OxmlElement('w:t'); piece.set(XML_SPACE, 'preserve'); piece.text = ch
                    pieces.append(piece)
            else:
                pieces.append(child)
        parent, position = run.getparent(), run.getparent().index(run)
        parent.remove(run)
        for offset, piece in enumerate(pieces):
            new = OxmlElement('w:r')
            if properties is not None:
                new.append(copy.deepcopy(properties))
            new.append(piece)
            parent.insert(position + offset, new)


def _merge(element):
    """Join neighbouring plain text runs that share formatting."""
    for parent in {run.getparent() for run in element.iter(W_R)}:
        previous = None
        for node in list(parent):
            plain = node.tag == W_R and all(child.tag in (W_RPR, W_T) for child in node) and len(node.findall(W_T)) == 1
            if plain and previous is not None:
                a, b = previous.find(W_RPR), node.find(W_RPR)
                same = (a is None and b is None) or (a is not None and b is not None and a.xml == b.xml)
                if same:
                    target = previous.find(W_T)
                    target.text = (target.text or '') + (node.find(W_T).text or '')
                    target.set(XML_SPACE, 'preserve')
                    parent.remove(node)
                    continue
            previous = node if plain else None


def _value_properties(source, underline=False):
    properties = copy.deepcopy(source) if source is not None else OxmlElement('w:rPr')
    for tag in ('w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:color', 'w:highlight', 'w:shd', 'w:strike', 'w:vanish', 'w:u', 'w:em', 'w:spacing', 'w:w'):
        for node in properties.findall(qn(tag)):
            properties.remove(node)
    # The rPr helpers keep Word's required child order.
    if underline:
        properties.get_or_add_u().set(qn('w:val'), 'single')
    # Symbols such as △ or □ follow the East Asian font, never the Latin one.
    properties.get_or_add_rFonts().set(qn('w:hint'), 'eastAsia')
    return properties


def _underlined(run):
    properties = run.find(W_RPR) if run is not None else None
    u = properties.find(qn('w:u')) if properties is not None else None
    return u is not None and u.get(qn('w:val')) != 'none'


def _text_width(text, properties):
    """Approximate width in twips: full-width characters are one em."""
    size = properties.find(qn('w:sz')) if properties is not None else None
    em = int(size.get(qn('w:val'))) * 10 if size is not None else 240
    return sum(em if unicodedata.east_asian_width(ch) in 'WF' else em // 2 for ch in text)


def _value_runs(text, properties):
    runs = []
    for index, line in enumerate(str(text).replace('\r\n', '\n').split('\n')):
        run = OxmlElement('w:r'); run.append(copy.deepcopy(properties))
        if index:
            run.append(OxmlElement('w:br'))
        t = OxmlElement('w:t'); t.set(XML_SPACE, 'preserve'); t.text = line
        run.append(t); runs.append(run)
    return runs


def _paragraph_after(paragraph, runs):
    new = OxmlElement('w:p')
    properties = paragraph.find(qn('w:pPr'))
    if properties is not None:
        new.append(copy.deepcopy(properties))
    for run in runs:
        new.append(run)
    paragraph.addnext(new)
    return new


NOTE_SIZE = 24  # the form's 12pt body text


def _note_paragraph(pieces, indent, before=0, keep_next=False):
    """A supplement paragraph aligned with the text inside the form's tables."""
    paragraph = OxmlElement('w:p')
    pp = OxmlElement('w:pPr'); paragraph.append(pp)
    if keep_next:
        pp.append(OxmlElement('w:keepNext'))
    spacing = OxmlElement('w:spacing'); spacing.set(qn('w:before'), str(before)); spacing.set(qn('w:after'), '0')
    spacing.set(qn('w:line'), '300'); spacing.set(qn('w:lineRule'), 'auto'); pp.append(spacing)
    # Explicit zeros: the form's Normal style carries character-based and
    # hanging indents that would otherwise pull the first line left.
    ind = OxmlElement('w:ind')
    for name, value in (('leftChars', 0), ('left', indent), ('firstLineChars', 0), ('firstLine', 0)):
        ind.set(qn('w:' + name), str(value))
    pp.append(ind)
    for value, bold in pieces:
        properties = OxmlElement('w:rPr')
        fonts = OxmlElement('w:rFonts'); fonts.set(qn('w:hint'), 'eastAsia'); properties.append(fonts)
        if bold:
            properties.append(OxmlElement('w:b'))
        sz = OxmlElement('w:sz'); sz.set(qn('w:val'), str(NOTE_SIZE)); properties.append(sz)
        for run in _value_runs(value, properties):
            paragraph.append(run)
    return paragraph


def _notes(section, notes, indent):
    """「…補充資料」 heading, then 標題：內容 lines; further lines of one note
    are indented two characters beneath their title."""
    paragraphs = [_note_paragraph([(f'{section}補充資料', True)], indent, before=120, keep_next=True)]
    for note in notes:
        lines = [line for line in str(note['text']).replace('\r\n', '\n').split('\n') if line.strip()] or ['']
        paragraphs.append(_note_paragraph([(note['title'] + '：', True), (lines[0], False)], indent))
        paragraphs += [_note_paragraph([(line, False)], indent + 480) for line in lines[1:]]
    return paragraphs


def _pdf_chars(geometry):
    """PDF characters per source page, serialised in the Word reading order."""
    pages = {}
    for page in geometry:
        chars, cells = [], []
        for block in sorted(page['blocks'], key=lambda b: b['top']):
            if block['kind'] == 'table':
                containers = sorted(block['cells'], key=lambda c: (round(c['box'][1]), c['box'][0]))
                for cell in containers:
                    cells.append(dict(cell=cell, table=block))
            else:
                containers = [block]
            for container in containers:
                lines = {}
                for ch in container['chars']:
                    lines.setdefault(round((ch['top'] + ch['bottom']) / 2 / 3), []).append(ch)
                for key in sorted(lines):
                    for ch in sorted(lines[key], key=lambda c: c['x0']):
                        chars.append(dict(ch, norm=_norm(ch['text']), container=container, table=block if block['kind'] == 'table' else None))
        pages[page['source']] = dict(chars=chars, cells=cells)
    return pages


class FormFiller:
    def __init__(self, geometry):
        self.document = Document(FORM)
        self.body = self.document.element.body
        self.originals = list(self.body)
        if len(self.originals) != FINAL_ELEMENT + 1 or '學年/學期目標' not in ''.join(t.text or '' for t in self.originals[GOALS_TABLE].iter(W_T)):
            raise RuntimeError('iep-form-template.docx no longer matches the PARTS layout map.')
        for element in self.originals:
            _explode(element)
        self.docx_chars = []
        for ei, element in enumerate(self.originals):
            for ti, t in enumerate(_texts(element)):
                n = _norm(t.text or '')
                if t.text and not _blank(n):
                    self.docx_chars.append((n, ei, ti))
        self.pages = _pdf_chars(geometry)
        pdf_sequence, owners = [], []
        for source in sorted(self.pages):
            for ch in self.pages[source]['chars']:
                ch['index'] = None
                if not _blank(ch['norm']):
                    ch['index'] = len(pdf_sequence); pdf_sequence.append(ch['norm']); owners.append(ch)
        matcher = difflib.SequenceMatcher(None, ''.join(pdf_sequence), ''.join(c[0] for c in self.docx_chars), autojunk=False)
        self.mapping = {}
        for block in matcher.get_matching_blocks():
            for k in range(block.size):
                self.mapping[block.a + k] = block.b + k
        self.unplaced = []

    # -- fragments ---------------------------------------------------------
    def _fragment(self, source, repeat=False):
        nodes, texts, rows_to_drop = [], {}, []
        skip = REPEAT_SKIP.get(source, set()) if repeat else set()
        for part in PARTS[source]:
            if len(part) == 2:
                for ei in range(part[0], part[1] + 1):
                    if ei in skip:
                        continue
                    clone = copy.deepcopy(self.originals[ei]); nodes.append(clone); texts[ei] = (clone, _texts(clone))
            else:
                ei, first, end = part
                clone = copy.deepcopy(self.originals[ei]); nodes.append(clone); texts[ei] = (clone, _texts(clone))
                rows = clone.findall(W_TR)
                rows_to_drop.extend((clone, row) for index, row in enumerate(rows) if index < first or (end is not None and index >= end))
        for clone, row in rows_to_drop:
            clone.remove(row)
        for node in nodes:
            for tag in ('w:bookmarkStart', 'w:bookmarkEnd'):
                for mark in list(node.iter(qn(tag))):
                    mark.getparent().remove(mark)
        return nodes, texts

    def _restart_numbering(self, nodes):
        """A repeated page numbers its notes from the start again."""
        numbering = self.document.part.numbering_part.element
        replaced = {}
        for node in nodes:
            for num_id in node.iter(qn('w:numId')):
                old = num_id.get(qn('w:val'))
                if old in (None, '0'):
                    continue
                if old not in replaced:
                    original = numbering.num_having_numId(int(old))
                    new = numbering.add_num(original.abstractNumId.val)
                    overrides = {o.get(qn('w:ilvl')) for o in original.findall(qn('w:lvlOverride'))}
                    for override in original.findall(qn('w:lvlOverride')):
                        new.append(copy.deepcopy(override))
                    abstract = next(a for a in numbering.findall(qn('w:abstractNum')) if a.get(qn('w:abstractNumId')) == str(original.abstractNumId.val))
                    for level in abstract.findall(qn('w:lvl')):
                        if level.get(qn('w:ilvl')) in overrides:
                            continue
                        start = level.find(qn('w:start'))
                        new.add_lvlOverride(ilvl=int(level.get(qn('w:ilvl')))).add_startOverride(int(start.get(qn('w:val'))) if start is not None else 1)
                    replaced[old] = str(new.numId)
                num_id.set(qn('w:val'), replaced[old])

    def _run(self, texts, ch):
        if ch is None or ch['index'] is None or ch['index'] not in self.mapping:
            return None
        _, ei, ti = self.docx_chars[self.mapping[ch['index']]]
        if ei not in texts:
            return None
        root, nodes = texts[ei]
        t = nodes[ti]
        node = t
        while node is not None and node is not root:
            node = node.getparent()
        return t.getparent() if node is root and t.getparent() is not None else None

    # -- placement ---------------------------------------------------------
    def _cell_tc(self, page, texts, pdf_cell):
        """The Word cell holding most of a PDF cell's matched characters."""
        votes = {}
        for ch in page['chars']:
            if ch['container'] is not pdf_cell or _blank(ch['norm']):
                continue
            run = self._run(texts, ch)
            tc = next((a for a in run.iterancestors() if a.tag == W_TC), None) if run is not None else None
            if tc is not None:
                votes[tc] = votes.get(tc, 0) + 1
        return max(votes, key=votes.get) if votes else None

    @staticmethod
    def _inside(ch, box, pad=0):
        x, y = (ch['x0'] + ch['x1']) / 2, (ch['top'] + ch['bottom']) / 2
        return box[0] - pad <= x <= box[2] + pad and box[1] - pad <= y <= box[3] + pad

    def _cell_of(self, page, box):
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        candidates = [c for c in page['cells'] if c['cell']['box'][0] <= cx <= c['cell']['box'][2] and c['cell']['box'][1] <= cy <= c['cell']['box'][3]]
        return min(candidates, key=lambda c: (c['cell']['box'][2] - c['cell']['box'][0]) * (c['cell']['box'][3] - c['cell']['box'][1])) if candidates else None

    def _tc_for(self, page, texts, target, y):
        """Find the Word cell for an empty PDF cell through a labelled neighbour."""
        table = target['table']
        row = sorted([c for c in table['cells'] if c['box'][1] - 1 <= y <= c['box'][3] + 1], key=lambda c: c['box'][0])
        if target['cell'] not in row:
            return None
        k = row.index(target['cell'])
        same_top = lambda c: abs(c['box'][1] - target['cell']['box'][1]) < 2
        order = sorted((j for j in range(len(row)) if j != k), key=lambda j: (not same_top(row[j]), abs(j - k), j > k))
        for j in order:
            tc = self._cell_tc(page, texts, row[j])
            if tc is None:
                continue
            tr = tc.getparent()
            if not same_top(row[j]):
                rows = tr.getparent().findall(W_TR)
                ys = table['ys']
                shift = sum(1 for v in ys if row[j]['box'][1] + 1 < v <= target['cell']['box'][1] + 1)
                index = rows.index(tr) + shift
                if index >= len(rows):
                    return None
                tr = rows[index]
                column = self._grid_start(tc)
                tc = next((cell for cell in tr.findall(W_TC) if self._grid_start(cell) == column), None)
                if tc is None:
                    return None
            cells = tr.findall(W_TC)
            index = cells.index(tc) + (k - j)
            if not 0 <= index < len(cells):
                return None
            return self._restart(cells[index])
        return self._tc_below_heading(page, texts, target)

    def _tc_below_heading(self, page, texts, target):
        """An all-blank row, such as a goal row or the signature row, is
        located from its column heading and the PDF row lines in between."""
        table, box = target['table'], target['cell']['box']
        cx = (box[0] + box[2]) / 2
        headings = sorted((c for c in table['cells'] if c['box'][3] <= box[1] + 1 and c['box'][0] - 1 <= cx <= c['box'][2] + 1), key=lambda c: -c['box'][1])
        for heading in headings:
            tc = self._cell_tc(page, texts, heading)
            if tc is None:
                continue
            rows = tc.getparent().getparent().findall(W_TR)
            shift = sum(1 for v in table['ys'] if heading['box'][1] + 1 < v <= box[1] + 1)
            index = rows.index(tc.getparent()) + shift
            if index >= len(rows):
                return None
            column = self._grid_start(tc)
            cell = next((c for c in rows[index].findall(W_TC) if self._grid_start(c) == column), None)
            return self._restart(cell) if cell is not None else None
        return None

    @staticmethod
    def _grid_start(tc):
        start = 0
        for cell in tc.getparent().findall(W_TC):
            if cell is tc:
                return start
            span = cell.find(qn('w:tcPr') + '/' + qn('w:gridSpan'))
            start += int(span.get(qn('w:val'))) if span is not None else 1
        return start

    def _restart(self, tc):
        merge = tc.find(qn('w:tcPr') + '/' + qn('w:vMerge'))
        if merge is None or merge.get(qn('w:val')) == 'restart':
            return tc
        column, tr = self._grid_start(tc), tc.getparent()
        rows = tr.getparent().findall(W_TR)
        for previous in reversed(rows[:rows.index(tr)]):
            cell = next((c for c in previous.findall(W_TC) if self._grid_start(c) == column), None)
            if cell is None:
                return tc
            merge = cell.find(qn('w:tcPr') + '/' + qn('w:vMerge'))
            if merge is None or merge.get(qn('w:val')) == 'restart':
                return cell
        return tc

    def _fill_cell(self, tc, runs):
        paragraph = next((p for p in tc.findall(W_P) if not ''.join(t.text or '' for t in p.iter(W_T)).strip()), None)
        if paragraph is None:
            last = tc.findall(W_P)[-1]
            return _paragraph_after(last, runs)
        for run in runs:
            paragraph.append(run)
        return paragraph

    def _insert_after(self, run, value):
        """Write after a label on its writing line. Underlined spaces are taken
        over; underlined tabs stay, because the form wraps its lines on them."""
        parent = run.getparent()
        siblings = [n for n in parent if n.tag == W_R]
        position = siblings.index(run) + 1
        while position < len(siblings) and _run_text(siblings[position]) in ('：', ':'):
            run = siblings[position]; position += 1
        following = siblings[position] if position < len(siblings) else None
        spaces = []
        while position < len(siblings) and _writing_line(siblings[position]) and _run_text(siblings[position]):
            spaces.append(siblings[position]); position += 1
        properties = _value_properties(run.find(W_RPR), _writing_line(following))
        runs = _value_runs(value, properties)
        for blank in spaces:
            parent.remove(blank)
        # The value takes the room of the writing-line tabs it covers, so the
        # line keeps its length and the form does not wrap onto a new line.
        tabs = []
        while position < len(siblings) and _writing_line(siblings[position]) and siblings[position].find(qn('w:tab')) is not None:
            tabs.append(siblings[position]); position += 1
        covered = _text_width(value.split('\n')[-1], properties) // TAB_STOP
        for tab in tabs[:min(len(tabs) - 1, covered)] if tabs else []:
            parent.remove(tab)
        anchor = run
        for new in runs:
            anchor.addnext(new); anchor = new

    @staticmethod
    def _chunk(chars, edge, side):
        """The run of printed characters touching the box, e.g. its label."""
        chunk = []
        for ch in chars:
            near = ch['x1'] if side == 'left' else ch['x0']
            last = edge if not chunk else (chunk[-1]['x0'] if side == 'left' else chunk[-1]['x1'])
            if abs(last - near) > (40 if not chunk else 8):
                break
            chunk.append(ch)
        return chunk

    def _find_label(self, texts, label):
        """Find a label in this page's Word text when the alignment skipped it."""
        label = label.strip()
        if len(label) < 2:
            return None
        for root, _ in texts.values():
            for paragraph in root.iter(W_P):
                runs = [r for r in paragraph.iter(W_R) if not _in_fallback(r) and len(_run_text(r)) == 1]
                text = ''.join(_norm(_run_text(r)) for r in runs)
                position = text.find(label)
                if position >= 0 and text.find(label, position + 1) < 0:
                    return runs[position + len(label) - 1]
        return None

    def _place_date(self, covered, covered_runs, value):
        """Write 115/8/31 as 115＿年 8＿月 31＿日 when the form prints 年月日."""
        parts = re.fullmatch(r'\s*(\d{2,4})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*', value)
        labels = {}
        for ch, run in zip(covered, covered_runs):
            if run is not None and ch['norm'] in '年月日' and ch['norm'] not in labels:
                labels[ch['norm']] = run
        if not parts or len(labels) != 3:
            return False
        for label, part in zip('年月日', parts.groups()):
            run = labels[label]
            start = run
            while _writing_line(start.getprevious()):
                start = start.getprevious()
            underline = start is not run
            for new in _value_runs(part.lstrip('0') or '0', _value_properties(run.find(W_RPR), underline)):
                start.addprevious(new)
        return True

    def place_field(self, page, texts, field):
        x, y, width, height = field['box']
        box = [x, y, x + width, y + height]
        value = field['value']
        covered = [ch for ch in page['chars'] if not _blank(ch['norm']) and self._inside(ch, box)]
        # The box can overlap the label's colon or the closing bracket after
        # the writing line; those stay printed. Inner label words are replaced.
        while covered and covered[0]['norm'] in '：:，,、':
            covered.pop(0)
        while covered and covered[-1]['norm'] in '）)' and not any(ch['norm'] in '（(' for ch in covered):
            covered.pop()
        runs_of_covered = [self._run(texts, ch) for ch in covered]
        if self._place_date(covered, runs_of_covered, value):
            return True
        covered_runs = [r for r in runs_of_covered if r is not None]
        if 0 < len(covered_runs) <= 2 and _writing_line(covered_runs[0].getprevious()) and not any(_run_text(r) in value for r in covered_runs):
            # "國中＿年級": the box reaches the unit after the writing line.
            # The value belongs on the line and the printed unit stays.
            start = covered_runs[0]
            while _writing_line(start.getprevious()):
                start = start.getprevious()
            for new in _value_runs(value, _value_properties(covered_runs[0].find(W_RPR), True)):
                start.addprevious(new)
            return True
        if covered_runs:
            first = covered_runs[0]; parent = first.getparent()
            siblings = [n for n in parent if n.tag == W_R]
            mine = [siblings.index(r) for r in covered_runs if r.getparent() is parent]
            start, end = min(mine), max(mine)
            # The printed writing lines around replaced words belong to the value.
            while start > 0 and _writing_line(siblings[start - 1]):
                start -= 1
            while end + 1 < len(siblings) and _writing_line(siblings[end + 1]):
                end += 1
            span = siblings[start:end + 1]
            blank_style = next((r for r in span if _writing_line(r)), None)
            style = first if blank_style is None else blank_style
            runs = _value_runs(value, _value_properties(style.find(W_RPR), blank_style is not None))
            removable = set(covered_runs) | {r for r in span if _writing_line(r) or _blank(_run_text(r))}
            opening = not any(_run_text(r).strip() for r in siblings[:start])
            if opening and any(r.find(qn('w:tab')) is not None for r in span) and any(_run_text(r).strip() for r in siblings[end + 1:]):
                # A heading such as "＿學校 ＿學年度學生個別化教育計畫" wrapped on
                # its writing lines; keep the rest of the heading on its own line.
                runs[-1].append(OxmlElement('w:br'))
            anchor = span[0].getprevious()
            for node in span:
                if node in removable:
                    parent.remove(node)
            for other in covered_runs:
                if other.getparent() is not None and other in removable:
                    other.getparent().remove(other)
            if anchor is None:
                for new in reversed(runs):
                    parent.insert(0 if parent.tag != W_P or parent.find(qn('w:pPr')) is None else 1, new)
            else:
                for new in runs:
                    anchor.addnext(new); anchor = new
            return True
        target = self._cell_of(page, box)
        if target is not None:
            pool = [ch for ch in page['chars'] if ch['container'] is target['cell']]
        else:
            pool = [ch for ch in page['chars'] if ch['table'] is None]
        top = y + min(height, 18)
        line = [ch for ch in pool if y - 4 <= (ch['top'] + ch['bottom']) / 2 <= top and not _blank(ch['norm'])]
        left = self._chunk(sorted([ch for ch in line if ch['x1'] <= x + 3], key=lambda c: -c['x1']), x, 'left')
        right = self._chunk(sorted([ch for ch in line if ch['x0'] >= x + width - 3], key=lambda c: c['x0']), x + width, 'right')
        for ch in left:
            run = self._run(texts, ch)
            if run is not None:
                self._insert_after(run, value)
                return True
        run = self._find_label(texts, ''.join(ch['norm'] for ch in reversed(left)))
        if run is not None:
            self._insert_after(run, value)
            return True
        for ch in right:
            run = self._run(texts, ch)
            if run is not None:
                for new in _value_runs(value + ' ', _value_properties(run.find(W_RPR))):
                    run.addprevious(new)
                return True
        above = sorted([ch for ch in pool if ch['bottom'] <= y + 4 and not _blank(ch['norm'])], key=lambda c: (c['top'], c['x0']))
        for ch in reversed(above):
            run = self._run(texts, ch)
            if run is not None:
                paragraph = next((a for a in run.iterancestors() if a.tag == W_P), None)
                following = paragraph.getnext() if paragraph is not None else None
                runs = _value_runs(value, _value_properties(run.find(W_RPR)))
                if following is not None and following.tag == W_P and not ''.join(t.text or '' for t in following.iter(W_T)).strip():
                    for new in runs:
                        following.append(new)
                elif paragraph is not None:
                    _paragraph_after(paragraph, runs)
                else:
                    continue
                return True
        if target is not None:
            tc = self._tc_for(page, texts, target, (box[1] + box[3]) / 2)
            if tc is not None:
                style = next((r.find(W_RPR) for r in tc.getparent().iter(W_R) if r.find(W_RPR) is not None and _run_text(r).strip()), None)
                self._fill_cell(tc, _value_runs(value, _value_properties(style)))
                return True
        return False

    def place_image(self, page, texts, image):
        x, y, width, height = image['box']
        target = self._cell_of(page, [x, y, x + width, y + height])
        if target is None:
            return False
        # A certificate cell holds its printed caption; the picture goes below it.
        tc = self._cell_tc(page, texts, target['cell']) or self._tc_for(page, texts, target, y + height / 2)
        if tc is None:
            return False
        raw = base64.b64decode(image['base64'])
        from docx.image.image import Image
        info = Image.from_blob(raw)
        width_node = tc.find(qn('w:tcPr') + '/' + qn('w:tcW'))
        cell_width = int(width_node.get(qn('w:w'))) / 20 - 12 if width_node is not None and width_node.get(qn('w:w')) else width
        scale = min(cell_width / info.px_width, width / info.px_width, height / info.px_height)
        paragraph = OxmlElement('w:p')
        tc.append(paragraph)
        Paragraph(paragraph, self.document._body).add_run().add_picture(io.BytesIO(raw), width=Pt(info.px_width * scale), height=Pt(info.px_height * scale))
        return True

    def place_check(self, page, texts, check):
        boxes = [ch for ch in page['chars'] if ch['norm'] == '□' and abs(check['x'] - ch['x0']) < 9 and abs(check['y'] - ch['top']) < 9]
        for ch in sorted(boxes, key=lambda c: abs(check['x'] - c['x0']) + abs(check['y'] - c['top'])):
            run = self._run(texts, ch)
            if run is None:
                # The printed option text around an unmatched box can differ;
                # take the next box after the nearest matched text on its line.
                line = [c for c in page['chars'] if c['container'] is ch['container'] and abs(c['top'] - ch['top']) < 4 and c['x1'] <= ch['x0'] + 1]
                for previous in sorted(line, key=lambda c: -c['x1']):
                    anchor = self._run(texts, previous)
                    if anchor is None:
                        continue
                    following = [r for r in anchor.itersiblings() if r.tag == W_R][:12]
                    run = next((r for r in following if _run_text(r) in ('□', '☐')), None)
                    break
            if run is not None:
                t = run.find(W_T)
                if t is not None and _norm(t.text or '') == '□':
                    t.text = CHECKED
                    return True
            if ch['table'] is not None and self._check_bullet(page, texts, ch):
                return True
        return False

    def _check_bullet(self, page, texts, ch):
        """Some option boxes are list bullets; tick by writing ■ in their place."""
        target = next((c for c in page['cells'] if c['cell'] is ch['container']), None)
        if target is None:
            return False
        tc = self._cell_tc(page, texts, target['cell']) or self._tc_for(page, texts, target, (ch['top'] + ch['bottom']) / 2)
        if tc is None:
            return False
        boxes = sorted((c for c in page['chars'] if c['container'] is ch['container'] and c['norm'] == '□'), key=lambda c: (c['top'], c['x0']))
        bullets = [p for p in tc.iter(W_P) if p.find(qn('w:pPr') + '/' + qn('w:numPr')) is not None]
        index = boxes.index(ch)
        if index >= len(bullets):
            return False
        paragraph = bullets[index]
        properties = paragraph.find(qn('w:pPr'))
        properties.remove(properties.find(qn('w:numPr')))
        first = paragraph.find(W_R)
        mark = _value_runs(CHECKED, _value_properties(first.find(W_RPR) if first is not None else None))[0]
        properties.addnext(mark)
        return True

    def fill(self, model, output):
        final = self.originals[FINAL_ELEMENT]
        for element in self.originals[:FINAL_ELEMENT]:
            self.body.remove(element)
        used = set()
        for page_model in model['pages']:
            source = page_model['source']
            page = self.pages[source]
            nodes, texts = self._fragment(source, source in used)
            if source in used:
                self._restart_numbering(nodes)
            used.add(source)
            for node in nodes:
                final.addprevious(node)
            for check in page_model['checks']:
                if not self.place_check(page, texts, check):
                    self.unplaced.append((source, 'check', f"{check['x']:.0f},{check['y']:.0f}"))
            notes = []
            for field in sorted(page_model['fields'], key=lambda f: (f['box'][1], f['box'][0])):
                if not self.place_field(page, texts, field):
                    self.unplaced.append((source, 'field', field['label']))
                    notes.append(dict(title=field['label'], text=field['value']))
            for image in page_model['images']:
                if not self.place_image(page, texts, image):
                    self.unplaced.append((source, 'image', ''))
            placed_values = {field['value'] for field in page_model['fields']}
            for note in page_model['notes']:
                if note['text'] not in placed_values and note not in notes:
                    notes.append(note)
            if notes:
                last = nodes[-1]
                holder = last if last.tag == W_P and last.find('.//' + qn('w:sectPr')) is not None else None
                tables = [n for n in nodes if n.tag == qn('w:tbl')]
                table_indent = tables[-1].find(qn('w:tblPr') + '/' + qn('w:tblInd')) if tables else None
                # The table indent reaches its border; 108 twips is Word's
                # default cell padding, so the notes line up with cell text.
                indent = (int(table_indent.get(qn('w:w'))) if table_indent is not None else 322) + 108
                for paragraph in _notes(page_model['section'], notes, indent):
                    if holder is not None:
                        holder.addprevious(paragraph)
                    else:
                        nodes[-1].addnext(paragraph); nodes[-1] = paragraph
        for node in self.body:
            for row_height in node.iter(qn('w:trHeight')):
                # Printed row heights are writing space, never a clipping limit.
                if row_height.get(qn('w:hRule')) == 'exact':
                    row_height.set(qn('w:hRule'), 'atLeast')
            _merge(node)
        properties = self.document.core_properties
        properties.title = f'{model["studentName"]} {model["academicYear"]}學年度 個別化教育計畫'
        properties.author = properties.last_modified_by = 'EyeEP'
        self.document.save(output)
        for item in self.unplaced:
            print('unplaced', *item, file=sys.stderr)
        return self.unplaced


def fill(model, output, geometry):
    """Returns what fell back to supplement paragraphs instead of the form."""
    return FormFiller(geometry).fill(model, output)
