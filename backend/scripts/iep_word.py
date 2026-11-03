"""Native editable IEP forms. PDF is a build-time reference, never a page image.

Build: --build-template. Fill: --model data.json --output filled.docx.
Dependencies: python-docx; build-time only: pdfplumber.
"""
import argparse
import base64
import copy
import io
import json
import re
from pathlib import Path
from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
TEMPLATE = ASSETS / 'iep-word-template.docx'
GEOMETRY = ASSETS / 'iep-word-template.json'
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def el(name, **attrs):
    node = OxmlElement('w:' + name)
    for k, v in attrs.items():
        node.set(qn('w:' + k), str(v))
    return node

def inside(x, y, box, tolerance=0):
    return box[0]-tolerance <= x <= box[2]+tolerance and box[1]-tolerance <= y <= box[3]+tolerance

def boxxy(box):
    x, y, w, h = box
    return [x, y, x+w, y+h]

def cluster(values, tolerance=.8):
    result = []
    for n in sorted(values):
        if not result or n-result[-1] > tolerance:
            result.append(n)
    return result

def char_lines(chars):
    lines = []
    for c in sorted(chars, key=lambda c: (round(c['top']/3), c['x0'])):
        if not lines or abs(c['top']-lines[-1][0]) > 3:
            lines.append([c['top'], []])
        lines[-1][1].append(c)
    return lines

def source_text(chars):
    return '\n'.join(''.join(c['text'] for c in sorted(line, key=lambda c:c['x0'])).strip() for _, line in char_lines(chars)).strip()

def paragraph(text='', color='000000', bold=False, size=10.5, keep=False, center=False):
    p = el('p'); pr = el('pPr'); p.append(pr)
    pr.append(el('spacing', before=0, after=35, line=250, lineRule='auto'))
    pr.append(el('wordWrap', val=1))
    if keep: pr.append(el('keepNext'))
    if center: pr.append(el('jc', val='center'))
    for i, line in enumerate(str(text).split('\n')):
        r = el('r'); rp = el('rPr'); r.append(rp)
        rp.append(el('rFonts', ascii='Times New Roman', hAnsi='Times New Roman', eastAsia='標楷體'))
        rp.append(el('sz', val=int(size*2))); rp.append(el('szCs', val=int(size*2)))
        rp.append(el('color', val=color)); rp.append(el('lang', val='zh-TW', eastAsia='zh-TW'))
        if bold: rp.append(el('b'))
        if i: r.append(el('br'))
        t=el('t'); t.set('{http://www.w3.org/XML/1998/namespace}space','preserve'); t.text=line; r.append(t); p.append(r)
    return p

def sdt(tag, contents):
    s=el('sdt'); pr=el('sdtPr'); pr.append(el('tag', val=tag)); s.append(pr)
    c=el('sdtContent'); s.append(c)
    for child in contents: c.append(child)
    return s

def color_of(chars):
    colors = [c.get('non_stroking_color') for c in chars]
    if any(isinstance(c, (tuple,list)) and len(c)>=3 and c[0]>.7 and c[1]<.25 for c in colors): return 'D90000'
    if any(isinstance(c, (tuple,list)) and len(c)>=3 and c[2]>.45 and c[0]<.3 for c in colors): return '0070C0'
    return '000000'

def table_node(table):
    xs, ys = table['xs'],table['ys']; cells=table['cells']
    t=el('tbl'); pr=el('tblPr'); t.append(pr)
    pr.append(el('tblW', w=round((xs[-1]-xs[0])*20),type='dxa'))
    pr.append(el('tblInd', w=max(0,round((xs[0]-32)*20)),type='dxa'))
    pr.append(el('tblLayout',type='fixed'))
    borders=el('tblBorders'); pr.append(borders)
    for edge in ['top','left','bottom','right','insideH','insideV']: borders.append(el(edge,val='single',sz=5,color='000000'))
    margins=el('tblCellMar');pr.append(margins)
    for edge in ['top','bottom']: margins.append(el(edge,w=45,type='dxa'))
    for edge in ['left','right']: margins.append(el(edge,w=55,type='dxa'))
    grid=el('tblGrid');t.append(grid)
    for a,b in zip(xs,xs[1:]): grid.append(el('gridCol',w=round((b-a)*20)))
    for ri,(top,bottom) in enumerate(zip(ys,ys[1:])):
        row=el('tr');t.append(row);rp=el('trPr');row.append(rp)
        rp.append(el('cantSplit'))
        if ri==0: rp.append(el('tblHeader'))
        ci=0
        while ci < len(xs)-1:
            midx=(xs[ci]+xs[ci+1])/2;midy=(top+bottom)/2
            cell=next((c for c in cells if inside(midx,midy,c['box'])),None)
            end=ci+1
            if cell:
                while end<len(xs)-1 and xs[end]<cell['box'][2]-.8: end+=1
            tc=el('tc');row.append(tc);cp=el('tcPr');tc.append(cp)
            cp.append(el('tcW',w=round((xs[end]-xs[ci])*20),type='dxa'))
            if end-ci>1: cp.append(el('gridSpan',val=end-ci))
            if cell and cell['box'][3]-cell['box'][1] > bottom-top+1:
                cp.append(el('vMerge',val='restart' if abs(cell['box'][1]-top)<1 else 'continue'))
            cp.append(el('vAlign',val='top'))
            if cell and abs(cell['box'][1]-top)<1:
                text=source_text(cell['chars'])
                tc.append(sdt(cell['id'],[paragraph(text,color_of(cell['chars']),size=9.5 if len(xs)>6 else 10.5)]))
            else: tc.append(paragraph())
            ci=end
    return t

def build_template():
    import pdfplumber
    pages=[]
    with pdfplumber.open(ASSETS/'iep-reference.pdf') as pdf:
        for n,p in enumerate(pdf.pages,1):
            chars=[{k:c.get(k) for k in ['text','x0','x1','top','bottom','size','fontname','non_stroking_color']} for c in p.chars if c['top']<768]
            blocks=[];occupied=[]
            detected=p.find_tables()
            # The source's double rules and open-ended information rows confuse
            # generic PDF table detection. Declare their actual semantic grids.
            special=[]
            if n==16:
                xs=[28.08,128.39,226.01,328.15,436.74,567.36];ys=[54.36,72,90,611,747.58]
                boxes=[(xs[0],ys[0],xs[-1],ys[1]),(xs[0],ys[1],xs[3],ys[2]),(xs[3],ys[1],xs[4],ys[2]),(xs[4],ys[1],xs[5],ys[2])]
                boxes += [(xs[i],ys[2],xs[i+1],ys[3]) for i in range(5)]
                boxes += [(xs[0],ys[3],xs[-1],ys[4])]
                special=[(xs,ys,boxes)];detected=[]
            elif n==17:
                xs=[32.94,121.1,560.58];ys=[167.3,191.22,215.14,239.06,262.98]
                special=[(xs,ys,[(xs[i],ys[j],xs[i+1],ys[j+1]) for j in range(4) for i in range(2)])]
                detected=[t for t in detected if t.bbox[1]>270]
            for ti,(xs,ys,boxes) in enumerate(special):
                cells=[]
                for ci,box in enumerate(boxes):
                    cs=[c for c in chars if inside((c['x0']+c['x1'])/2,(c['top']+c['bottom'])/2,box)]
                    cells.append({'id':f'p{n}-special{ti}-c{ci}','box':list(box),'chars':cs})
                bounds=[xs[0],ys[0],xs[-1],ys[-1]]
                blocks.append({'kind':'table','top':ys[0],'box':bounds,'cells':cells,'xs':xs,'ys':ys});occupied.append(bounds)
            for ti,t in enumerate(detected):
                if t.bbox[1]>768:continue
                cells=[]
                for ci,box in enumerate(t.cells):
                    cs=[c for c in chars if inside((c['x0']+c['x1'])/2,(c['top']+c['bottom'])/2,box)]
                    cells.append({'id':f'p{n}-t{ti}-c{ci}','box':list(box),'chars':cs})
                blocks.append({'kind':'table','top':t.bbox[1],'box':list(t.bbox),'cells':cells,'xs':cluster([v for c in t.cells for v in [c[0],c[2]]]),'ys':cluster([v for c in t.cells for v in [c[1],c[3]]])})
                occupied.append(t.bbox)
            outside=[c for c in chars if not any(inside((c['x0']+c['x1'])/2,(c['top']+c['bottom'])/2,b) for b in occupied)]
            for li,(top,cs) in enumerate(char_lines(outside)):
                blocks.append({'kind':'text','id':f'p{n}-l{li}','top':top,'box':[min(c['x0'] for c in cs),top,max(c['x1'] for c in cs),max(c['bottom'] for c in cs)],'chars':cs})
            # Filled rectangles already describe the PDF's table rules. Drawing
            # their edges again would thicken every rule and create thousands
            # of unnecessary Word objects.
            edges=[{k:e.get(k) for k in ['x0','x1','top','bottom','linewidth','stroking_color']} for e in p.edges if e.get('object_type')!='curve_edge' and e.get('stroke') and e['top']<770]
            fills=[{k:r.get(k) for k in ['x0','x1','top','bottom','non_stroking_color']} for r in p.rects if r.get('fill') and r.get('non_stroking_color') not in [1,(1,1,1),[1,1,1],None] and r['top']<770]
            pages.append({'source':n,'blocks':sorted(blocks,key=lambda b:b['top']),'edges':edges,'fills':fills})
    GEOMETRY.write_text(json.dumps(pages,ensure_ascii=False),encoding='utf-8')
    from iep_word_fixed import build_template as fixed_template
    fixed_template(pages,TEMPLATE)
    print(json.dumps({'template':str(TEMPLATE),'pages':len(pages)}))

def filled_text(block, fields, checks):
    chars=[]
    for original in block['chars']:
        c=copy.copy(original);cx=(c['x0']+c['x1'])/2;cy=(c['top']+c['bottom'])/2
        if any(inside(cx,cy,boxxy(f['box'])) for f in fields): continue
        if c['text'] in ['□','☐'] and any(abs(k['x']-c['x0'])<9 and abs(k['y']-c['top'])<9 for k in checks):c['text']='☑'
        chars.append(c)
    entries=[(top,min(c['x0'] for c in cs),''.join(c['text'] for c in sorted(cs,key=lambda c:c['x0'])).strip()) for top,cs in char_lines(chars)]
    entries.extend((f['box'][1],f['box'][0],f['value']) for f in fields)
    # Separate long field values as normal flowing paragraphs, never positioned text.
    grouped=[]
    for y,x,text in sorted(entries,key=lambda r:(round(r[0]/4),r[1])):
        if not text.strip():continue
        if grouped and abs(y-grouped[-1][0])<4:
            grouped[-1][1]+='　'+text
        else:grouped.append([y,text])
    return '\n'.join(text for _,text in grouped)

def fill(model, output, layout='editable'):
    geometry = json.loads(GEOMETRY.read_text(encoding='utf-8'))
    if layout == 'reference':
        from iep_word_fixed import fill as fixed_fill
        fixed_fill(model,output,TEMPLATE,geometry)
    else:
        from iep_word_editable import fill as editable_fill
        editable_fill(model,output,geometry)
    print(json.dumps({'output':str(output),'forms':len(model['pages'])}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--build-template',action='store_true');p.add_argument('--model');p.add_argument('--output');p.add_argument('--layout',choices=['editable','reference'],default='editable');args=p.parse_args()
    if args.build_template:build_template()
    else:fill(json.loads(Path(args.model).read_text(encoding='utf-8')),Path(args.output),args.layout)
