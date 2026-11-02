import sys,json,copy,statistics
from pathlib import Path
import iep_word as w
from docx import Document
from lxml import etree as ET
import os,re,io,base64,math
from PIL import ImageFont
from docx.text.paragraph import Paragraph
from docx.image.image import Image
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH


def smallp():
 p=w.paragraph(size=1);pr=p.find('w:pPr',w.NS)
 for c in list(pr):pr.remove(c)
 pr.append(w.el('spacing',before=0,after=0,line=1,lineRule='exact'))
 return p

def sourcep(container):
 chars=container['chars'];lines=w.char_lines(chars)
 if not chars:return smallp()
 size=statistics.median(c['size'] for c in chars)
 # The PDF's CJK point sizes survive without the former global 10.5pt reset.
 p=w.paragraph(w.source_text(chars),size=round(size*2)/2,color=w.color_of(chars),bold=size>=13)
 pr=p.find('w:pPr',w.NS);pr.find('w:spacing',w.NS).set(w.qn('w:after'),'0')
 tops=[top for top,_ in lines]
 leading=statistics.median([b-a for a,b in zip(tops,tops[1:])]) if len(tops)>1 else size*1.05
 pr.find('w:spacing',w.NS).set(w.qn('w:line'),str(max(1,round(leading*20))))
 pr.find('w:spacing',w.NS).set(w.qn('w:lineRule'),'exact')
 return p

def canvas(page):
 containers=[]
 for b in page['blocks']:
  if b['kind']=='table':
   for c in b['cells']:containers.append({**c,'border':True})
  else:containers.append({**b,'border':False})
 # Outside text stays at its original x/y; the grid's white cells are invisible.
 xs=w.cluster([0,595.32]+[x for c in containers for x in (c['box'][0],c['box'][2])],.55)
 ys=w.cluster([35,770]+[y for c in containers for y in (c['box'][1],c['box'][3]) if y>=35],.55)
 def snap(value,values):return min(values,key=lambda n:abs(n-value))
 for c in containers:c['snap']=[snap(c['box'][0],xs),snap(c['box'][1],ys),snap(c['box'][2],xs),snap(c['box'][3],ys)]
 t=w.el('tbl');pr=w.el('tblPr');t.append(pr)
 pr.append(w.el('tblW',w=round(595.32*20),type='dxa'));pr.append(w.el('tblLayout',type='fixed'))
 margins=w.el('tblCellMar');pr.append(margins)
 for edge in ['left','right','top','bottom']:margins.append(w.el(edge,w=0,type='dxa'))
 borders=w.el('tblBorders');pr.append(borders)
 for edge in ['top','bottom','left','right','insideH','insideV']:borders.append(w.el(edge,val='nil'))
 grid=w.el('tblGrid');t.append(grid)
 for a,b in zip(xs,xs[1:]):grid.append(w.el('gridCol',w=round((b-a)*20)))
 for top,bottom in zip(ys,ys[1:]):
  row=w.el('tr');t.append(row);rp=w.el('trPr');row.append(rp)
  rp.append(w.el('trHeight',val=round((bottom-top)*20),hRule='exact'));rp.append(w.el('cantSplit'))
  ci=0
  while ci<len(xs)-1:
   x=(xs[ci]+xs[ci+1])/2;y=(top+bottom)/2
   c=next((c for c in containers if w.inside(x,y,c['snap'])),None)
   end=ci+1
   if c:
    while end<len(xs)-1 and xs[end]<c['snap'][2]-.2:end+=1
   else:
    while end<len(xs)-1 and not any(w.inside((xs[end]+xs[end+1])/2,y,c['snap']) for c in containers):end+=1
   tc=w.el('tc');row.append(tc);cp=w.el('tcPr');tc.append(cp)
   cp.append(w.el('tcW',w=round((xs[end]-xs[ci])*20),type='dxa'))
   if end-ci>1:cp.append(w.el('gridSpan',val=end-ci))
   start=c and abs(c['snap'][1]-top)<.2
   if c and c['snap'][3]-c['snap'][1]>bottom-top+.2:cp.append(w.el('vMerge',val='restart' if start else 'continue'))
   cb=w.el('tcBorders');cp.append(cb)
   for edge in ['top','bottom','left','right']:cb.append(w.el(edge,val='nil'))
   if c and start:
    mar=w.el('tcMar');cp.append(mar)
    chars=c['chars'];xpad=max(0,min((z['x0'] for z in chars),default=c['box'][0])-c['box'][0])
    ypad=max(0,min((z['top'] for z in chars),default=c['box'][1])-c['box'][1]-1.8)
    mar.append(w.el('left',w=round(xpad*20),type='dxa'));mar.append(w.el('right',w=0,type='dxa'));mar.append(w.el('top',w=round(ypad*20),type='dxa'));mar.append(w.el('bottom',w=0,type='dxa'))
    tc.append(smallp())
   else:tc.append(smallp())
   ci=end
 return t

def frame(parent, ident, box, content, inset='0,0,0,0'):
 x,y,width,height=box
 r=w.el('r');parent.append(r);pict=w.el('pict');r.append(pict)
 v='urn:schemas-microsoft-com:vml';o='urn:schemas-microsoft-com:office:office'
 shape=ET.SubElement(pict,'{'+v+'}rect',nsmap={'v':v,'o':o})
 shape.set('id',ident);shape.set('stroked','f');shape.set('filled','f');shape.set('{'+o+'}allowincell','f')
 shape.set('style',f'position:absolute;margin-left:{x}pt;margin-top:{y}pt;width:{width}pt;height:{height}pt;z-index:251658240;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-style:none')
 textbox=ET.SubElement(shape,'{'+v+'}textbox');textbox.set('inset',inset)
 tx=w.el('txbxContent');textbox.append(tx);tx.append(content)
 return tx

def static_layer(page, fields=(), checks=(), prefix=''):
 p=smallp();containers=[]
 vectors(p,page,prefix)
 for b in page['blocks']:containers+=b['cells'] if b['kind']=='table' else [b]
 seen=set()
 for c in containers:
  chars=[]
  for src in c['chars']:
   key=(src['x0'],src['top'],src['text'])
   if key in seen:continue
   seen.add(key);ch=copy.copy(src);cx=(ch['x0']+ch['x1'])/2;cy=(ch['top']+ch['bottom'])/2
   if any(w.inside(cx,cy,w.boxxy(f['box'])) for f in fields):continue
   if ch['text'] in ['□','☐'] and any(abs(k['x']-ch['x0'])<9 and abs(k['y']-ch['top'])<9 for k in checks):ch['text']='☑'
   chars.append(ch)
  for li,(top,line) in enumerate(w.char_lines(chars)):
   groups=[]
   for ch in sorted(line,key=lambda z:z['x0']):
    family=lambda c:'kai' if 'DFKai' in (c.get('fontname') or '') else (c.get('fontname') or '')
    if (not groups or ch['x0']-groups[-1][-1]['x1']>1.2
        or family(ch)!=family(groups[-1][-1])):groups.append([])
    groups[-1].append(ch)
   for gi,group in enumerate(groups):
    while group and group[0]['text'].isspace():group.pop(0)
    while group and group[-1]['text'].isspace():group.pop()
    if not group:continue
    size=statistics.median(ch['size'] for ch in group);x=min(ch['x0'] for ch in group)
    shape_box=[x,top-size*.16,max(3,c['box'][2]-x+14),max(size*1.6,16)]
    source={**c,'chars':group};para=sourcep(source)
    times_only=all('TimesNewRoman' in (ch.get('fontname') or '') for ch in group)
    kai_only=all('DFKai' in (ch.get('fontname') or '') for ch in group)
    if times_only or kai_only:
     for fonts in para.findall('.//w:rFonts',w.NS):
      for attr in ['ascii','hAnsi','eastAsia']:fonts.set(w.qn('w:'+attr),'標楷體' if kai_only else 'Times New Roman')
    value=w.source_text(group);actual=max(ch['x1'] for ch in group)-x
    if times_only:
     measured=ImageFont.truetype(str(Path(os.environ.get('SystemRoot','C:/Windows'))/'Fonts/times.ttf'),200).getlength(value)/200*(round(size*2)/2)
    elif kai_only:
     measured=ImageFont.truetype(str(Path(os.environ.get('SystemRoot','C:/Windows'))/'Fonts/kaiu.ttf'),200).getlength(value)/200*(round(size*2)/2)
    else:measured=width(value,round(size*2)/2)
    scale=max(50,min(150,round(100*actual/measured))) if measured else 100
    for rp in para.findall('.//w:rPr',w.NS):rp.append(w.el('w',val=scale))
    frame(p,prefix+c['id']+f'-l{li}-{gi}',shape_box,w.sdt(c['id']+f'-l{li}-{gi}',[para]))
 return p

def rgb(value):
 if isinstance(value,(int,float)):value=[value]*3
 if value and len(value)==1:value=value*3
 if not value or len(value)<3:return '#000000'
 return '#'+''.join(f'{max(0,min(255,round(n*255))):02x}' for n in value[:3])

def vectors(parent,page,prefix):
 v='urn:schemas-microsoft-com:vml';o='urn:schemas-microsoft-com:office:office'
 colors={}
 for b in page.get('fills',[]):
  color=rgb(b['non_stroking_color'])
  if color=='#ffffff':continue
  x0,y0,x1,y1=[round(b[k]*100) for k in ['x0','top','x1','bottom']]
  colors.setdefault(color,set()).add((x0,y0,x1,y1))
 # Group native rules into one anchored drawing per color. The original rule
 # rectangles stay editable without thousands of independent page anchors.
 for color,boxes in colors.items():
  if color!='#000000':
   for x0,y0,x1,y1 in sorted(boxes):
    r=w.el('r');parent.append(r);pic=w.el('pict');r.append(pic);rect=ET.SubElement(pic,'{'+v+'}rect',nsmap={'v':v,'o':o})
    rect.set('style',f'position:absolute;margin-left:{x0/100}pt;margin-top:{y0/100}pt;width:{(x1-x0)/100}pt;height:{(y1-y0)/100}pt;z-index:1;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-style:none')
    rect.set('stroked','f');rect.set('fillcolor',color);rect.set('{'+o+'}allowincell','f')
   continue
  r=w.el('r');parent.append(r);pic=w.el('pict');r.append(pic);group=ET.SubElement(pic,'{'+v+'}group',nsmap={'v':v,'o':o})
  group.set('coordsize','59532,84192');group.set('coordorigin','0,0')
  group.set('style','position:absolute;margin-left:0pt;margin-top:0pt;width:595.32pt;height:841.92pt;z-index:-251658240;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-style:none')
  group.set('{'+o+'}allowincell','f')
  for x0,y0,x1,y1 in sorted(boxes):
   rect=ET.SubElement(group,'{'+v+'}rect')
   rect.set('style',f'position:absolute;left:{x0};top:{y0};width:{x1-x0};height:{y1-y0}')
   rect.set('stroked','f');rect.set('fillcolor',color)
 seen=set()
 for i,e in enumerate(page.get('edges',[])):
  key=tuple(round(e[k],2) for k in ['x0','x1','top','bottom'])
  if key in seen:continue
  seen.add(key)
  r=w.el('r');parent.append(r);pic=w.el('pict');r.append(pic);line=ET.SubElement(pic,'{'+v+'}line',nsmap={'v':v,'o':o})
  line.set('from',f"{e['x0']}pt,{e['top']}pt");line.set('to',f"{e['x1']}pt,{e['bottom']}pt")
  line.set('style','position:absolute;z-index:2;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;mso-wrap-style:none')
  line.set('strokeweight',f"{e.get('linewidth') or .4}pt");line.set('strokecolor',rgb(e.get('stroking_color')));line.set('{'+o+'}allowincell','f')

def setup():
 doc=Document();sec=doc.sections[0]
 sec.page_width=Pt(595.32);sec.page_height=Pt(841.92)
 for attr in ['left_margin','right_margin','top_margin','bottom_margin']:setattr(sec,attr,Pt(0))
 # Reserve the original footer band when continuation tables flow across pages.
 sec.bottom_margin=Pt(65)
 sec.top_margin=Pt(35)
 sec.footer_distance=Pt(50)
 f=sec.footer.paragraphs[0];f.alignment=WD_ALIGN_PARAGRAPH.CENTER
 r=f.add_run();r.font.size=Pt(9);r._r.append(w.el('fldChar',fldCharType='begin'));r._r.append(w.el('instrText'));r._r[-1].text='PAGE';r._r.append(w.el('fldChar',fldCharType='end'))
 body=doc._element.body;sect=body.find(w.qn('w:sectPr'))
 for child in list(body):
  if child is not sect:body.remove(child)
 return doc,body,sect

def build_template(pages,path):
 doc,body,sect=setup()
 for i,page in enumerate(pages):
  if i:
   p=smallp();p.find('w:pPr',w.NS).append(w.el('pageBreakBefore'));body.insert(body.index(sect),p)
  body.insert(body.index(sect),w.sdt(f'source-page-{page["source"]}',[static_layer(page,prefix=f'p{i}-'),canvas(page)]))
 doc.core_properties.title='個別化教育計畫 原 PDF 版面 Word 範本'
 doc.save(path)

_fonts={}
def width(text,size):
 root=Path(os.environ.get('SystemRoot','C:/Windows'))/'Fonts'
 def font(kind):
  if kind not in _fonts:
   path=os.environ.get('IEP_WORD_FONT_PATH') if kind=='cjk' else None
   _fonts[kind]=ImageFont.truetype(path or str(root/('kaiu.ttf' if kind=='cjk' else 'times.ttf')),200)
  return _fonts[kind]
 return sum(font('latin' if ord(c)<128 else 'cjk').getlength(c)/200*size for c in text)

def wrap(text,space,size):
 lines=[]
 for paragraph in text.replace('\r\n','\n').replace('\r','\n').split('\n'):
  line=''
  for char in paragraph:
   if line and width(line+char,size)>space:lines.append(line);line=char
   else:line+=char
  lines.append(line)
 return lines

def field_frame(layer,field,index):
 x,y,bw,bh=field['box'];value=field['value'];style=field.get('style') or {}
 size=style.get('size') or (16 if field['label']=='學校與學年度' else 10.5)
 minimum=style.get('min') or (7 if '姓名' in field['label'] else 8)
 while True:
  leading=size*1.12;capacity=max(0,math.floor((bh-1)/leading));lines=wrap(value,max(1,bw-4),size)
  if len(lines)<=capacity or len(value)>40 or size<=minimum:break
  size-=.5
 capacity=max(0,math.floor((bh-1)/leading))
 shown=lines[:capacity];overflow=len(lines)>capacity
 if overflow and shown:
  last=shown[-1]
  while last and width(last+'…',size)>bw-4:last=last[:-1]
  shown[-1]=last+'…'
 if shown:
  para=w.paragraph('\n'.join(shown),size=size,center=style.get('align')=='center')
  spacing=para.find('w:pPr/w:spacing',w.NS);spacing.set(w.qn('w:after'),'0');spacing.set(w.qn('w:line'),str(round(leading*20)));spacing.set(w.qn('w:lineRule'),'exact')
  frame(layer,f'field-{index}',[x+2,y-size*.16+.5,max(1,bw-4),bh],w.sdt('data-'+str(index),[para]))
 return overflow

def continuation(body,sect,section,notes,index):
 # Overflow is a bounded table with repeated headings, never loose paragraphs.
 p=smallp();p.find('w:pPr',w.NS).append(w.el('pageBreakBefore'));body.insert(body.index(sect),p)
 heading=w.paragraph(section+'（續表）',color='D90000',bold=True,size=14,keep=True)
 pr=heading.find('w:pPr',w.NS);pr.append(w.el('ind',left=700));pr.find('w:spacing',w.NS).set(w.qn('w:before'),'0');body.insert(body.index(sect),heading)
 t=w.el('tbl');pr=w.el('tblPr');t.append(pr);pr.append(w.el('tblW',w=10400,type='dxa'));pr.append(w.el('tblInd',w=700,type='dxa'));pr.append(w.el('tblLayout',type='fixed'))
 borders=w.el('tblBorders');pr.append(borders)
 for edge in ['top','bottom','left','right','insideH','insideV']:borders.append(w.el(edge,val='single',sz=5,color='000000'))
 grid=w.el('tblGrid');t.append(grid)
 for val in [2600,7800]:grid.append(w.el('gridCol',w=val))
 for ri,row in enumerate([('欄位／項目','完整內容')]+[(n['title'],n['text']) for n in notes]):
  tr=w.el('tr');t.append(tr)
  if not ri:rp=w.el('trPr');rp.append(w.el('tblHeader'));tr.append(rp)
  for ci,text in enumerate(row):
   tc=w.el('tc');tr.append(tc);cp=w.el('tcPr');tc.append(cp);cp.append(w.el('tcW',w=[2600,7800][ci],type='dxa'))
   mar=w.el('tcMar');cp.append(mar)
   for edge in ['top','bottom','left','right']:mar.append(w.el(edge,w=70,type='dxa'))
   tc.append(w.paragraph(text,size=11,bold=not ri))
 body.insert(body.index(sect),t)

def fill(model,output,template,geometry):
 source=Document(template);pages={int(s.find('w:sdtPr/w:tag',w.NS).get(w.qn('w:val')).split('-')[-1]):s for s in source._element.body.findall('w:sdt',w.NS)}
 doc,body,sect=setup();geo={p['source']:p for p in geometry}
 for i,page in enumerate(model['pages']):
  if i:
   p=smallp();p.find('w:pPr',w.NS).append(w.el('pageBreakBefore'));body.insert(body.index(sect),p)
  block=copy.deepcopy(pages[page['source']]);content=block.find('w:sdtContent',w.NS)
  # Retain the template's native Word grid; replace only editable text layers.
  for child in list(content):
   if child.tag!=w.qn('w:tbl'):content.remove(child)
  layer=static_layer(geo[page['source']],page['fields'],page['checks'],prefix=f'f{i}-');content.insert(0,layer)
  notes=[]
  for fi,field in enumerate(page['fields']):
   field=copy.deepcopy(field)
   x,y,bw,bh=field['box']
   cells=[c for b in geo[page['source']]['blocks'] if b['kind']=='table' for c in b['cells']
          if w.inside(x+bw/2,y+bh/2,c['box']) and bw<=c['box'][2]-c['box'][0]+5]
   if cells:
    cell=min(cells,key=lambda c:(c['box'][2]-c['box'][0])*(c['box'][3]-c['box'][1]))['box']
    bottom=min(y+bh,cell[3]-2);y=max(y,cell[1]+2);bh=max(0,bottom-y)
   for other in page['fields']:
    ox,oy,ow,oh=other['box']
    if y<oy<y+bh and min(x+bw,ox+ow)-max(x,ox)>min(bw,ow)*.5:
     bh=min(bh,oy-y-1)
   field['box']=[x,y,bw,bh]
   if field_frame(layer,field,f'{i}-{fi}'):notes.append({'title':field['label'],'text':field['value']})
  for image_no,image in enumerate(page['images']):
   x,y,bw,bh=image['box'];raw=base64.b64decode(image['base64']);info=Image.from_blob(raw);scale=min(bw/info.px_width,bh/info.px_height)
   para=w.paragraph(size=1)
   para.find('w:pPr/w:spacing',w.NS).set(w.qn('w:after'),'0')
   # Inline images need an automatic line height; the 0.05pt anchor paragraph
   # used for floating text would otherwise clip the certificate entirely.
   run=Paragraph(para,doc._body).add_run();run.font.size=Pt(1)
   run.add_picture(io.BytesIO(raw),width=Pt(info.px_width*scale),height=Pt(info.px_height*scale))
   frame(layer,f'image-{i}-{image_no}',[x,y,bw,bh],para)
  body.insert(body.index(sect),block)
  for n in page['notes']:
   if not any(n['text']==f['value'] for f in page['fields']) and not any(n==old for old in notes):notes.append(n)
  if notes:continuation(body,sect,page['section'],notes,i)
 doc.core_properties.title=f'{model["studentName"]} {model["academicYear"]}學年度 個別化教育計畫';doc.core_properties.author='EyeEP';doc.save(output)
