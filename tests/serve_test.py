"""Local browser-test server; never opens or copies the working database."""
import sys
import tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import app

with tempfile.TemporaryDirectory(prefix='wve-ui-') as directory:
    app.DB_PATH=Path(directory)/'test.db'
    app.DEMO_MODE=True
    app.init_db()
    server=app.ThreadingHTTPServer(('127.0.0.1',9987),app.Handler)
    print('TEST_SERVER_READY http://127.0.0.1:9987',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
