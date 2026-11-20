"""Build a source distribution from an allowlist, never include working data."""
import ast
import sys
import zipfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
tree=ast.parse((root/'app.py').read_text(encoding='utf-8'))
version=next(n.value.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SOFTWARE_VERSION' for t in n.targets))
target=root/'release'/f'Wieseke_Vorlagen-Engine_v{version}.zip'
if target.exists() and '--replace' not in sys.argv:raise SystemExit(f'Release already exists: {target}; use --replace only after successful verification.')
files=['app.py','bid_workbooks.py','document_tools.py','email_images.py','requirements.txt','README.md','DEPLOYMENT.md','UPDATE.md','CHANGELOG.md','ARCHITECTURE.md','start_windows.bat','start_linux_mac.sh','beispiel-projekt.json']
obsolete={'static/modern.css','static/ui-shell.js','static/documents.js','static/email-images.js','static/bid-workbooks.js','static/project-api.js','tests/ui-navigation.mjs'}
for directory in ('static','core','modules','tests','excel','documents','tools'):
    base=root/directory
    if base.exists():
        for p in base.rglob('*'):
            relative=p.relative_to(root).as_posix()
            if not p.is_file() or '__pycache__' in p.parts or p.suffix in ('.pyc','.db','.log') or relative in obsolete:continue
            if directory=='tools' and p.name not in {'package_release.py','check_upgrade.py','check_release.py'}:continue
            files.append(relative)
target.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(set(files)):archive.write(root/file,file)
print(target)
