"""Regression tests for the confirmed review findings, using disposable data."""
import copy
import hashlib
import json
import sqlite3
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch
import test_login as baseline

app = baseline.app


class StabilizationTests(unittest.TestCase):
    csrf_tokens = {}
    setUpClass = classmethod(baseline.LoginEndToEndTest.setUpClass.__func__)
    tearDownClass = classmethod(baseline.LoginEndToEndTest.tearDownClass.__func__)
    new_client = baseline.LoginEndToEndTest.new_client
    authenticated_client = baseline.LoginEndToEndTest.authenticated_client
    json_request = baseline.LoginEndToEndTest.json_request

    def setUp(self):
        self.admin, _ = self.authenticated_client()
        app.API_RATE_BUCKETS.clear()

    def login(self, username, password):
        client, _ = self.new_client()
        self.csrf_tokens[id(client)] = 'unused'
        data = self.json_request(client, '/api/login', 'POST', {'username':username,'password':password})
        self.csrf_tokens[id(client)] = data['csrf_token']
        return client

    def create_user(self, permissions, must_change=False):
        name = self._testMethodName
        role = self.json_request(self.admin,'/api/roles','POST',{'name':name,'permissions':permissions,'all_categories':True})
        data = self.json_request(self.admin,'/api/users','POST',{'username':name,'first_name':'Test','last_name':'Person','role_id':role['id'],'must_change':must_change})
        uid = next(u['id'] for u in self.json_request(self.admin,'/api/users')['users'] if u['username']==name)
        return uid, data, self.login(name,data['temporary_password'])

    def denied(self, client, path, method='GET', data=None, status=403):
        with self.assertRaises(urllib.error.HTTPError) as result:
            self.json_request(client,path,method,data)
        self.assertEqual(result.exception.code,status)

    def test_target_account_guard_covers_all_actions(self):
        _,_,delegated = self.create_user(['users_manage'])
        admin_id = self.json_request(self.admin,'/api/me')['user']['id']
        for action,payload in [('password',{'new_password':'StrongPassword123!'}),('recovery',{}),('reset',{}),('unlock',{})]:
            self.denied(delegated,f'/api/users/{admin_id}/{action}','PUT',payload)
        self.denied(delegated,f'/api/users/{admin_id}','PUT',{'active':False})
        self.denied(delegated,'/api/integration/keys','POST',{'user_id':admin_id})
        self.denied(delegated,'/api/integration/keys/revoke','POST',{'user_id':admin_id})

    def test_every_domain_rejects_deletion_without_csrf(self):
        for path in ['/api/roles/999','/api/projects/999','/api/templates/999','/api/document-templates/999','/api/bidders/999']:
            request=urllib.request.Request(self.base_url+path,method='DELETE')
            with self.assertRaises(urllib.error.HTTPError) as error:self.admin.open(request)
            self.assertEqual(error.exception.code,403,path)

    def test_last_admin_cannot_be_disabled(self):
        uid=self.json_request(self.admin,'/api/me')['user']['id']
        self.denied(self.admin,f'/api/users/{uid}','PUT',{'active':False},409)
        self.denied(self.admin,f'/api/users/{uid}','PUT',{'active':0},409)

    def test_delegated_role_editor_cannot_escalate_own_role(self):
        uid,data,client=self.create_user(['users_manage','roles_manage'])
        role_id=self.json_request(client,'/api/me')['user']['role_id']
        payload={'name':'Escalation','permissions':['settings_manage'],'all_categories':True}
        self.denied(client,f'/api/roles/{role_id}','PUT',payload)
        self.denied(client,'/api/roles','POST',payload)

    def test_schema13_navigation_preserves_area_order(self):
        settings=self.json_request(self.admin,'/api/settings')['settings']
        areas={key:list(reversed(value)) for key,value in settings['navigation_areas'].items()}
        updated=self.json_request(self.admin,'/api/settings','PUT',{**settings,'navigation_areas':areas})
        self.assertEqual(updated['settings']['navigation_areas'],areas)
        self.denied(self.admin,'/api/settings','PUT',{**settings,'navigation_areas':{'work':['invalid']}},400)

    def test_password_reset_revokes_sessions_and_keys(self):
        uid,data,client=self.create_user(['projects_view','projects_api_create'])
        token=self.json_request(client,'/api/integration/keys','POST',{})['token']
        self.json_request(self.admin,f'/api/users/{uid}/password','PUT',{'new_password':'ChangedPassword123!'})
        self.denied(client,'/api/projects',status=401)
        with app.db() as conn:
            self.assertIsNotNone(conn.execute('SELECT revoked_at FROM project_api_keys WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),)).fetchone()[0])

    def test_change_password_rotates_session_preserves_key(self):
        uid,data,client=self.create_user(['projects_view','projects_api_create'])
        other=self.login(data['username'],data['temporary_password'])
        token=self.json_request(client,'/api/integration/keys','POST',{})['token']
        old_csrf=self.csrf_tokens[id(client)]
        changed=self.json_request(client,'/api/change-password','POST',{'old_password':data['temporary_password'],'new_password':'ChangedPassword123!'})
        self.assertNotEqual(changed['csrf_token'],old_csrf)
        self.json_request(client,'/api/projects')
        self.denied(other,'/api/projects',status=401)
        with app.db() as conn:
            self.assertIsNone(conn.execute('SELECT revoked_at FROM project_api_keys WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),)).fetchone()[0])

    def test_must_change_is_enforced_by_server(self):
        uid,data,client=self.create_user(['projects_view','projects_manage'],True)
        self.assertTrue(self.json_request(client,'/api/me')['user']['must_change'])
        self.denied(client,'/api/projects')
        self.denied(client,'/api/projects','POST',{'projekt':{'id':'x','bezeichnung':'x'}})

    def test_recovery_is_limited_and_revokes_credentials(self):
        uid,data,client=self.create_user(['projects_view','projects_api_create'])
        self.json_request(client,'/api/integration/keys','POST',{})
        anonymous,_=self.new_client()
        # Recovery is unauthenticated and does not use the helper's CSRF fetch.
        self.csrf_tokens[id(anonymous)]='unused'
        payload={'username':data['username'],'recovery_code':'invalid','new_password':'ChangedPassword123!'}
        for _ in range(3):self.denied(anonymous,'/api/recover','POST',payload,400)
        self.denied(anonymous,'/api/recover','POST',payload,429)
        with app.db() as conn:
            row=conn.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
            self.assertEqual(row['failed_recovery_attempts'],3);self.assertEqual(row['failed_login_attempts'],0)
        self.json_request(self.admin,f'/api/users/{uid}/unlock','PUT',{})
        payload['recovery_code']=data['recovery_code']
        self.json_request(anonymous,'/api/recover','POST',payload)
        self.denied(client,'/api/projects',status=401)
        with app.db() as conn:self.assertEqual(conn.execute('SELECT COUNT(*) FROM project_api_keys WHERE user_id=? AND revoked_at IS NULL',(uid,)).fetchone()[0],0)

    def test_revision_and_contacts_never_overwrite_other_data(self):
        data={'projekt':{'id':'REV','bezeichnung':'A','custom':'retained'},'kontakte':[]}
        created=self.json_request(self.admin,'/api/projects','POST',{'data':data})
        path=f"/api/projects/{created['id']}"
        self.json_request(self.admin,path+'/contacts','PUT',{'kontakte':[{'vorname':'Anna'}],'expected_revision':1})
        self.denied(self.admin,path,'PUT',{'data':data,'expected_revision':1},409)
        self.denied(self.admin,'/api/projects','POST',{'data':data},409)
        project=next(p for p in self.json_request(self.admin,'/api/projects')['projects'] if p['id']==created['id'])
        self.assertEqual(project['revision'],2)
        self.assertEqual(project['data']['kontakte'],[{'vorname':'Anna'}])
        self.assertEqual(project['data']['projekt']['custom'],'retained')

    def test_invalid_project_structures_are_rejected(self):
        for contacts in ('bad',{},[1],[{'name':[]}]):
            self.denied(self.admin,'/api/projects','POST',{'data':{'projekt':{'id':'BAD','bezeichnung':'Bad'},'kontakte':contacts}},400)

    def test_archiving_participates_in_project_revision_checks(self):
        data={'projekt':{'id':'REV-ARCHIVE','bezeichnung':'Vor dem Import'},'kontakte':[{'vorname':'Anna'}]}
        created=self.json_request(self.admin,'/api/projects','POST',{'data':data})
        path=f"/api/projects/{created['id']}"
        preview={'data':{**data,'projekt':{**data['projekt'],'bezeichnung':'Veralteter Import'}},'expected_revision':1}
        self.denied(self.admin,path,'DELETE',{},409)
        archived=self.json_request(self.admin,path,'DELETE',{'expected_revision':1})
        self.assertEqual(archived['revision'],2)
        self.denied(self.admin,'/api/projects','POST',preview,409)
        self.denied(self.admin,'/api/projects','POST',{**preview,'expected_revision':2},409)
        self.denied(self.admin,path+'/contacts','PUT',{'kontakte':[],'expected_revision':2},409)
        self.denied(self.admin,path,'PUT',{**preview,'expected_revision':2},409)
        self.denied(self.admin,path+'/restore','PUT',{},409)
        self.denied(self.admin,path+'/restore','PUT',{'expected_revision':1},409)
        result=self.json_request(self.admin,path+'/restore','PUT',{'expected_revision':2})
        self.assertEqual(result['revision'],3)
        self.denied(self.admin,path,'DELETE',{'expected_revision':2},409)
        self.denied(self.admin,'/api/projects','POST',preview,409)
        project=next(p for p in self.json_request(self.admin,'/api/projects')['projects'] if p['id']==created['id'])
        self.assertFalse(project['archived'])
        self.assertEqual(project['data'],data)

    def test_template_version_restore(self):
        template=self.json_request(self.admin,'/api/templates')['templates'][0]
        with app.db() as conn:version=conn.execute('SELECT id FROM template_versions WHERE template_id=?',(template['id'],)).fetchone()[0]
        self.json_request(self.admin,f"/api/templates/{template['id']}/versions/{version}/restore",'POST',{})

    def test_bootstrap_preserves_existing_admin(self):
        with app.db() as conn:conn.execute("UPDATE users SET active=0,must_change=1 WHERE username='admin'")
        try:
            app.init_db()
            with app.db() as conn:
                row=conn.execute("SELECT active,must_change FROM users WHERE username='admin'").fetchone()
                self.assertEqual(tuple(row),(0,1))
        finally:
            with app.db() as conn:conn.execute("UPDATE users SET active=1,must_change=0 WHERE username='admin'")

    def test_migration_refuses_newer_schema_and_is_repeatable(self):
        with app.db() as conn:conn.execute('UPDATE schema_meta SET schema_version=999')
        try:
            with self.assertRaises(RuntimeError):app.init_db()
        finally:
            with app.db() as conn:conn.execute('UPDATE schema_meta SET schema_version=?',(app.SCHEMA_VERSION,))
        app.init_db();app.init_db()
        with app.db() as conn:self.assertEqual(conn.execute('SELECT COUNT(*) FROM migration_log WHERE version=12').fetchone()[0],1)

    def test_daily_backup_runs_periodically(self):
        stop=unittest.mock.Mock()
        stop.wait.side_effect=[False,True]
        with patch.object(app,'create_daily_backup') as backup:
            app.backup_worker(stop);backup.assert_called_once()
