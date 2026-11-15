"""Exercise the public integration contract against an isolated HTTP server."""
import concurrent.futures
import hashlib
import json
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch
import test_login as baseline
app=baseline.app


class ProjectApiTests(unittest.TestCase):
    csrf_tokens={}
    setUpClass=classmethod(baseline.LoginEndToEndTest.setUpClass.__func__)
    tearDownClass=classmethod(baseline.LoginEndToEndTest.tearDownClass.__func__)
    new_client=baseline.LoginEndToEndTest.new_client
    authenticated_client=baseline.LoginEndToEndTest.authenticated_client
    json_request=baseline.LoginEndToEndTest.json_request

    def setUp(self):
        app.API_RATE_BUCKETS.clear()
        self.client,_=self.authenticated_client()
        self.token=self.json_request(self.client,'/api/integration/keys','POST',{})['token']

    def request(self,payload=None,token=None,content_type='application/json',path='/api/integration/projects',raw=None):
        payload=payload or {'schema_version':'1.0','projekt':{'id':self._testMethodName,'bezeichnung':'Münster & Köln'},'kontakte':[{'vorname':'Anna'}]}
        data=raw if raw is not None else json.dumps(payload,ensure_ascii=False).encode('utf-8')
        request=urllib.request.Request(self.base_url+path,data=data,headers={'Content-Type':content_type,'Authorization':'Bearer '+(self.token if token is None else token)})
        try:
            with urllib.request.urlopen(request) as response:return response.status,json.load(response)
        except urllib.error.HTTPError as error:return error.code,json.load(error)

    def test_create_duplicate_archive_and_audit(self):
        status,data=self.request();self.assertEqual(status,201)
        self.assertEqual(self.request()[0],409)
        with app.db() as conn:
            stored=conn.execute('SELECT * FROM projects WHERE id=?',(data['id'],)).fetchone()
            self.assertEqual(stored['name'],'Münster & Köln')
            self.assertEqual(json.loads(stored['data_json'])['kontakte'][0]['vorname'],'Anna')
            conn.execute('UPDATE projects SET archived=1 WHERE id=?',(data['id'],))
            audit=conn.execute("SELECT * FROM audit_log WHERE entity_type='project' AND entity_id=?",(str(data['id']),)).fetchone()
            self.assertEqual(audit['username'],'admin')
            self.assertNotIn(self.token,json.dumps(dict(audit)))
        self.assertEqual(self.request()[0],409)

    def test_concurrent_creation_is_atomic(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda _:self.request()[0],range(2)))
        self.assertEqual(sorted(results),[201,409])

    def test_token_rotation_revocation_and_hash_only(self):
        with app.db() as conn:
            row=conn.execute('SELECT * FROM project_api_keys WHERE token_hash=?',(hashlib.sha256(self.token.encode()).hexdigest(),)).fetchone()
            self.assertIsNotNone(row);self.assertNotIn(self.token,json.dumps(dict(row)))
        listing=self.json_request(self.client,'/api/integration/keys')
        self.assertNotIn(self.token,json.dumps(listing));self.assertNotIn('token_hash',json.dumps(listing))
        previous=self.token;self.token=self.json_request(self.client,'/api/integration/keys','POST',{})['token']
        self.assertEqual(self.request(token=previous)[0],401)
        self.assertEqual(self.request()[0],201)
        self.json_request(self.client,'/api/integration/keys/revoke','POST',{})
        self.assertEqual(self.request()[0],401)

    def test_cookie_not_enough_and_key_cannot_use_browser_endpoints(self):
        self.assertEqual(self.request(token='wrong')[0],401)
        with self.assertRaises(urllib.error.HTTPError) as result:
            self.json_request(self.client,'/api/integration/projects','POST',{})
        self.assertEqual(result.exception.code,401)
        self.assertEqual(self.request(path='/api/projects')[0],403)
        request=urllib.request.Request(self.base_url+'/api/integration/keys',data=b'{}',headers={'Content-Type':'application/json'})
        with self.assertRaises(urllib.error.HTTPError) as result:self.client.open(request)
        self.assertEqual(result.exception.code,403)

    def test_roles_deactivation_and_password_change_checked_live(self):
        with patch.object(app,'permissions_from_row',return_value=[]):self.assertEqual(self.request()[0],403)
        with app.db() as conn:
            uid=conn.execute("SELECT id FROM users WHERE username='admin'").fetchone()[0]
            conn.execute('UPDATE users SET active=0 WHERE id=?',(uid,))
        try:self.assertEqual(self.request()[0],401)
        finally:
            with app.db() as conn:conn.execute('UPDATE users SET active=1,must_change=1 WHERE id=?',(uid,))
        try:self.assertEqual(self.request()[0],403)
        finally:
            with app.db() as conn:conn.execute('UPDATE users SET must_change=0 WHERE id=?',(uid,))

    def test_validation_size_media_type_and_limits(self):
        for raw in [b'[]',b'{',b'{"schema_version":"9"}',b'{"schema_version":"1.0","projekt":{"id":3}}']:
            self.assertEqual(self.request(raw=raw)[0],400)
        self.assertEqual(self.request(raw=b'x'*256001)[0],413)
        self.assertEqual(self.request(content_type='text/plain')[0],415)
        digest=hashlib.sha256(self.token.encode()).hexdigest()
        minute=int(app.datetime.now(app.timezone.utc).timestamp())//60
        app.API_RATE_BUCKETS['key:'+digest]=[minute,60]
        self.assertEqual(self.request()[0],429)

    def test_key_ownership(self):
        with patch.object(app,'permissions_from_row',return_value=['projects_api_create']):
            with self.assertRaises(urllib.error.HTTPError) as result:
                self.json_request(self.client,'/api/integration/keys','POST',{'user_id':99999})
            self.assertEqual(result.exception.code,403)
            listing=self.json_request(self.client,'/api/integration/keys')
            self.assertTrue(all(row['username']=='admin' for row in listing['keys']))

    def test_bidder_comment_create_edit_and_import(self):
        payload={'bidder':'API Testbieter','company_name':'Firma','comment':'Zeile 1\nZeile 2'}
        self.json_request(self.client,'/api/bidders','POST',payload)
        bidder=next(row for row in self.json_request(self.client,'/api/bidders')['bidders'] if row['bidder']==payload['bidder'])
        self.assertEqual(bidder['comment'],payload['comment'])
        self.json_request(self.client,f'/api/bidders/{bidder["id"]}','PUT',{**payload,'comment':'Bearbeitet'})
        self.json_request(self.client,'/api/bidders/import','POST',{'bidders':[{**payload,'comment':'Importiert'}]})
        bidder=next(row for row in self.json_request(self.client,'/api/bidders')['bidders'] if row['bidder']==payload['bidder'])
        self.assertEqual(bidder['comment'],'Importiert')

    def test_migration_from_10_is_repeatable(self):
        with app.db() as conn:
            conn.execute("INSERT INTO bidders(bidder,created_at,updated_at) VALUES('Legacy',?,?)",(app.now_iso(),app.now_iso()))
            conn.execute('ALTER TABLE bidders DROP COLUMN comment')
            conn.execute('DROP TABLE project_api_keys')
        app.init_db();app.init_db()
        with app.db() as conn:
            self.assertEqual(conn.execute("SELECT comment FROM bidders WHERE bidder='Legacy'").fetchone()[0],'')
            self.assertEqual(conn.execute("SELECT count(*) FROM project_api_keys").fetchone()[0],0)


if __name__=='__main__':unittest.main()
