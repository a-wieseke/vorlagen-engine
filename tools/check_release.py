"""Start an unpacked distribution with disposable data and check its UI.

No working database or browser profile is opened. The child server is stopped
before the TemporaryDirectory is cleaned up, including on test failure.
"""
import argparse
import ast
import json
import os
import queue
import re
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import zipfile
from pathlib import Path

def check(archive):
    with tempfile.TemporaryDirectory(prefix='wve-release-') as directory:
        root=Path(directory).resolve()
        with zipfile.ZipFile(archive) as source:
            names=source.namelist()
            assert not any(name.endswith(('.db','.sqlite','.log')) or '.env' in Path(name).name for name in names)
            assert all((root/name).resolve().is_relative_to(root) for name in names)
            source.extractall(root)
        assignments={node.targets[0].id:node.value.value for node in ast.parse((root/'app.py').read_text(encoding='utf-8')).body if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and isinstance(node.value,ast.Constant)}
        env={**os.environ,'WVE_DATA_DIR':str(root/'isolated-data'),'WVE_DEMO_MODE':'1','WVE_OPEN_BROWSER':'0','WVE_PORT':'0','WVE_HOST':'127.0.0.1','WVE_SECURE_COOKIES':'0','PYTHONIOENCODING':'utf-8','PYTHONUNBUFFERED':'1'}
        process=subprocess.Popen([sys.executable,'-u','app.py'],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8')
        messages=queue.Queue()
        def collect():
            for line in process.stdout:messages.put(line)
        reader=threading.Thread(target=collect,daemon=True);reader.start()
        try:
            deadline=time.monotonic()+40;url=None
            while time.monotonic()<deadline:
                try:line=messages.get(timeout=1)
                except queue.Empty:
                    if process.poll() is not None:raise RuntimeError('Release server failed to start')
                    continue
                match=re.search(r'http://127\.0\.0\.1:\d+',line)
                if match:url=match[0];break
            if not url:raise RuntimeError('Release server startup timed out')
            with urllib.request.urlopen(url+'/health') as response:health=json.load(response)
            assert health['version']==assignments['SOFTWARE_VERSION'] and health['schema_version']==assignments['SCHEMA_VERSION']
            assert list((root/'isolated-data/backups').glob('daily-*.db')),'Startup backup missing'
            contracts_available=(root/'tests/ui-contracts.mjs').exists()
            result=subprocess.run(['node','tests/ui-contracts.mjs' if contracts_available else 'tests/ui-stabilization.mjs'],cwd=root,env={**env,'WVE_TEST_URL':url},capture_output=True,text=True,encoding='utf-8',timeout=150)
            if result.returncode:raise RuntimeError(result.stdout+result.stderr)
            if contracts_available:
                contracts=json.loads(result.stdout.strip().splitlines()[-1]);assert all(value=='PASS' for value in contracts.values()),contracts
            else:
                assert 'PASS' in result.stdout,result.stdout;contracts={'stabilization':'PASS'}
            if (root/'tests/ui-patch-401.mjs').exists():
                patch=subprocess.run(['node','tests/ui-patch-401.mjs'],cwd=root,env={**env,'WVE_TEST_URL':url},capture_output=True,text=True,encoding='utf-8',timeout=150)
                if patch.returncode:raise RuntimeError(patch.stdout+patch.stderr)
                contracts.update({line:'PASS' for line in patch.stdout.splitlines() if line.startswith('PASS:')})
            return {'result':'PASS','version':health['version'],'schema':health['schema_version'],'startup_backup':'PASS','browser_contracts':len(contracts),'archive_files':len(names),'working_data_included':False}
        finally:
            process.terminate();process.wait(timeout=10);reader.join(timeout=2);process.stdout.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('archive',type=Path);parser.add_argument('--report',type=Path)
    args=parser.parse_args();report=json.dumps(check(args.archive.resolve()),indent=2)
    if args.report:args.report.write_text(report,encoding='utf-8')
    print(report)
