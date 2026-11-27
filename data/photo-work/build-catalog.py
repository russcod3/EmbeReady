"""Build public attribution data from the authoritative installed image manifest."""
import pathlib,json,re,html,hashlib
root=pathlib.Path('.')
entries=json.loads((root/'server/data/hazard-photo-manifest.json').read_text(encoding='utf-8'))
public={}
for e in entries:
 if e['photo_url'] not in public:
  public[e['photo_url']]={k:e[k] for k in ['reference','location','userProvided']}
  public[e['photo_url']]['aiEdited']=e.get('aiEdited',False)
  public[e['photo_url']]['references']=[]
 public[e['photo_url']]['references'].append(e['reference'])
(root/'public/js/hazard-photo-data.js').write_text('// Generated from server/data/hazard-photo-manifest.json.\nexport const illustrativePhotos = '+json.dumps(public,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
esc=html.escape
sections=[]
for e in entries:
 credit=esc(e.get('author',''))+' · '+esc(e.get('license',''))
 if e.get('licenseUrl'): credit+=' · <a href="'+esc(e['licenseUrl'],quote=True)+'">License</a>'
 if e.get('sourcePage'): credit+=' · <a href="'+esc(e['sourcePage'],quote=True)+'">Original source photograph</a>'
 if e.get('sourceFilename'): credit+=' · '+esc(e['sourceArchive'])+' / '+esc(e['sourceFilename'])
 heading=('User-supplied scenario image · AI-edited details' if e.get('aiEdited') else 'User-supplied scenario image') if e['userProvided'] else 'Illustrative composite · AI-added hazard objects'
 sections.append('<article id="'+esc(e['reference'])+'"><h2>'+esc(e['reference'])+'</h2><p><strong>'+heading+'</strong></p><p>Background: '+esc(e['location'])+'.</p><p>'+esc(e['changes'])+'. These images do not verify a report, property condition or incident. The background photographer and property owner do not endorse the added scenario.</p><p>'+credit+'</p><img loading="lazy" src="'+esc(e['photo_url'])+'" alt="Illustration for '+esc(e['reference'])+'"></article>')
page='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hazard image sources · EmbeReady</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:900px;margin:auto;padding:28px;color:#29263d;background:#faf9f6}a{color:#5740ac}article{scroll-margin-top:24px;border-top:1px solid #d7d2dd;padding:24px 0}img{display:block;max-width:100%;max-height:520px;object-fit:contain;border-radius:10px}h1,h2{line-height:1.25}</style></head><body><a href="/">← EmbeReady</a><h1>Hazard image sources</h1><p>Most scenario images come directly from the ZIP supplied by the project owner. Three have localized AI-edited details; the remaining earlier composites and supplied HZ-0027 image are identified separately. Source locations have not been independently verified. These representative images do not document or verify the reported sites. Some images are reused for related hazard scenarios.</p>'+''.join(sections)+'</body></html>'
(root/'public/photo-credits.html').write_text(page,encoding='utf-8')
print('Catalog entries:',len(entries))
