"""Check an upgrade on an isolated SQLite backup, without changing the source.

Usage: python tools/check_upgrade.py --source PATH [--report PATH]
The report contains counts and schema numbers, never personal data or hashes.
"""
import argparse
import hashlib
import json
import sqlite3
import sys
import tempfile
from contextlib import closing
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import app

def digest(conn,table,columns='*'):
    rows=conn.execute(f'SELECT {columns} FROM {table} ORDER BY rowid').fetchall()
    return len(rows),hashlib.sha256(repr(rows).encode()).hexdigest()

def copy_database(source,target,readonly=False):
    with closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True) if readonly else sqlite3.connect(source)) as src:
        with closing(sqlite3.connect(target)) as dst:src.backup(dst)

def check(source):
    with tempfile.TemporaryDirectory(prefix='wve-upgrade-') as tmp:
        path=Path(tmp)/'copy.db';copy_database(source,path,True)
        with closing(sqlite3.connect(path)) as conn:
            version=conn.execute('SELECT schema_version FROM schema_meta').fetchone()[0]
            tables={r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            protected={name:'*' for name in ('templates','template_categories','categories','role_categories','dashboard_tiles','user_favorites','dashboard_quicklinks','bid_questions','bid_answers','document_templates') if name in tables}
            protected.update({'projects':'id,project_key,name,data_json,archived','users':'id,username,password_hash,recovery_hash,active,must_change,role_id'})
            before={table:digest(conn,table,columns) for table,columns in protected.items()}
            nav=conn.execute('SELECT navigation_order_json FROM app_settings WHERE id=1').fetchone()[0]
        app.DB_PATH=path;app.DEMO_MODE=False
        if version<=12:
            app.SCHEMA_VERSION=12;app.init_db()
        schema12=Path(tmp)/'schema12.db';copy_database(path,schema12)
        app.SCHEMA_VERSION=13;app.init_db();app.init_db()
        with closing(sqlite3.connect(path)) as conn:
            after={table:digest(conn,table,columns) for table,columns in protected.items()}
            assert before==after,'Protected business data changed during migration'
            assert conn.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
            assert conn.execute('SELECT navigation_order_json FROM app_settings WHERE id=1').fetchone()[0]==nav
            assert conn.execute('SELECT schema_version FROM schema_meta').fetchone()[0]==13
            assert conn.execute('SELECT COUNT(*) FROM migration_log WHERE version=13').fetchone()[0]==1
        # Roll back with the exact pre-upgrade backup, not a reverse migration.
        restored=Path(tmp)/'restored.db';copy_database(schema12,restored)
        with closing(sqlite3.connect(restored)) as conn:
            assert conn.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
            assert {table:digest(conn,table,columns) for table,columns in protected.items()}==before
        return {'result':'PASS','source_schema':version,'target_schema':13,'idempotent':True,'rollback_backup':'PASS','unchanged_tables':{name:count for name,(count,_) in before.items()}}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--report',type=Path)
    args=parser.parse_args();result=check(args.source.resolve());text=json.dumps(result,ensure_ascii=False,indent=2)
    if args.report:args.report.write_text(text,encoding='utf-8')
    print(text)
