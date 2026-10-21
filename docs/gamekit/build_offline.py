"""Build the offline copy of the GameKit Parts page (docs/gamekit/GameKit Parts.html):
    python docs/gamekit/build_offline.py <page.html> <db dir with parts/*.json> <thumbs dir> [out.html]
The live page (https://claude.ai/artifact/QhJ4V69mPdCEqMiTFyB4rm) reads its parts from the page's
database; this copy builds the rows and screenshots (as data URIs) into one file that opens anywhere.
Get the inputs from Claude: the page source, an ArtifactData `list` of `parts` saved with out_dir,
and the 640x360 thumbnails named <part id>.jpg.
"""
import base64, datetime, json, os, sys

page, dbdir, thumbs = sys.argv[1:4]
out = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'GameKit Parts.html')
src = open(page, encoding='utf-8').read()

parts = []
pdir = os.path.join(dbdir, 'parts')
for f in sorted(os.listdir(pdir)):
    if not f.endswith('.json'): continue
    pid = f[:-5]
    d = json.load(open(os.path.join(pdir, f), encoding='utf-8'))
    d = d.get('data', d)
    img = os.path.join(thumbs, pid + '.jpg')
    if os.path.exists(img):
        d['image'] = 'data:image/jpeg;base64,' + base64.b64encode(open(img, 'rb').read()).decode()
    else:
        d.pop('image', None)
    parts.append({'id': pid, **d})
parts.sort(key=lambda p: p.get('order', 0))

# swap the live database hookup for the built-in rows
start = src.index('render();\n(async () => {')
end = src.index('})();\n</script>') + len('})();\n')
data = json.dumps(parts, ensure_ascii=False).replace('</', '<\\/')
today = datetime.date.today().isoformat()
src = (src[:start] + '// Offline copy: the parts are built in (snapshot of the GameKit Parts page on claude.ai).\nparts = '
       + data + ';\nrender();\n' + src[end:])
src = src.replace('<div class="empty" id="loading"><b>Loading the inventory</b><span>The parts list lives in this page\'s database. If nothing appears, ask Claude to add the first part.</span></div>', '')
src = src.replace('Every reusable piece of the game, with how easily it lifts out.',
                  f'Every reusable piece of the game, with how easily it lifts out. Offline copy taken {today}; the live version is on claude.ai.')
assert 'claude.use' not in src, 'live database code left in'

head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n')
open(out, 'w', encoding='utf-8').write(head + src + '\n</body></html>\n')
print(out, len(parts), 'parts', os.path.getsize(out) // 1024, 'KB')
