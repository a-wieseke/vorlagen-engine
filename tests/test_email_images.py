"""Image safety, persistence and MIME round trips on an isolated database."""
import base64
import io
import json
import unittest
import urllib.error
import urllib.request
import zipfile
from email import policy
from email.parser import BytesParser
from unittest.mock import patch
from PIL import Image, PngImagePlugin
import test_login as baseline
app = baseline.app
images = app.email_images


def png(size=(240,120), kind="PNG"):
    stream=io.BytesIO()
    picture=Image.new("RGB",size,(35,110,160))
    if kind=="PNG":
        metadata=PngImagePlugin.PngInfo();metadata.add_text("private","remove me")
        picture.save(stream,format=kind,pnginfo=metadata)
    else: picture.save(stream,format=kind)
    return stream.getvalue()


class ImageTests(unittest.TestCase):
    csrf_tokens={}
    setUpClass=classmethod(baseline.LoginEndToEndTest.setUpClass.__func__)
    tearDownClass=classmethod(baseline.LoginEndToEndTest.tearDownClass.__func__)
    new_client=baseline.LoginEndToEndTest.new_client
    authenticated_client=baseline.LoginEndToEndTest.authenticated_client
    json_request=baseline.LoginEndToEndTest.json_request

    def html(self):
        return '<p>Vorher <strong>fett</strong><img src="'+images.data_url(png(),"png")+'" alt="Plan &amp; Ansicht" width="120"> Nachher</p>'

    def eml_request(self,client,html):
        return client.open(urllib.request.Request(self.base_url+'/api/email/eml',
            data=json.dumps({'recipient':'kunde@example.test','cc':'copy@example.test','subject':'Überprüfung','body_html':html}).encode(),
            headers={'Content-Type':'application/json','X-CSRF-Token':self.csrf_tokens[id(client)]})).read()

    def assert_mime(self,raw,count=1):
        message=BytesParser(policy=policy.default).parsebytes(raw)
        self.assertEqual(message['X-Unsent'],'1')
        self.assertEqual(message.get_content_type(),'multipart/alternative')
        text=message.get_body(('plain',)).get_content()
        html=message.get_body(('html',)).get_content()
        embedded=[part for part in message.walk() if part.get_content_maintype()=='image']
        self.assertEqual(len(embedded),count)
        self.assertNotIn('data:image',html)
        self.assertIn('fett',text)
        for part in embedded:
            cid=str(part['Content-ID']).strip('<>')
            self.assertIn('cid:'+cid,html)
            self.assertEqual(part.get_content_disposition(),'inline')
            self.assertIn(f'Content-ID: <{cid}>'.encode(),raw)
            with Image.open(io.BytesIO(part.get_payload(decode=True))) as image:self.assertEqual(image.size,(240,120))
        return message

    def test_normalize_png_jpeg_resize_metadata_and_idempotence(self):
        for kind in ['PNG','JPEG']:
            raw,subtype,width,height=images.normalize_image(png((2000,1000),kind))
            self.assertEqual((subtype,width,height),('png',1600,800))
            with Image.open(io.BytesIO(raw)) as image:self.assertFalse(image.info)
            self.assertEqual(images.normalize_image(raw)[0],raw)

    def test_invalid_format_size_and_pixel_limit(self):
        for raw in [b'<svg/>',b'not an image',b'',b'x'*(images.MAX_UPLOAD+1)]:
            with self.assertRaises(ValueError):images.normalize_image(raw)
        with patch.object(images,'MAX_PIXELS',100):
            with self.assertRaises(ValueError):images.normalize_image(png())

    def test_sanitizer_allowlist_dimensions_and_alt(self):
        clean=app.sanitize_email_html(self.html().replace('width="120"','width="999999" onerror="alert(1)" style="position:fixed"'))
        self.assertIn('width="240" height="120"',clean)
        self.assertNotIn('onerror',clean);self.assertNotIn('style=',clean)
        self.assertIn('[Bild: Plan & Ansicht]',app.html_to_plain_text(clean))
        self.assertEqual(app.sanitize_email_html(clean),clean)
        for src in ['https://example.test/tracker','file:///private','blob:secret','cid:untrusted']:
            self.assertNotIn('<img',app.sanitize_email_html(f'<p>Text<img src="{src}"></p>'))
        with self.assertRaises(ValueError):app.sanitize_email_html('<img src="data:image/svg+xml;base64,PHN2Zz4=">')

    def test_image_count_and_total_limits(self):
        with self.assertRaises(ValueError):app.sanitize_email_html(self.html()*11)
        with patch.object(images,'MAX_TOTAL',10):
            with self.assertRaises(ValueError):app.sanitize_email_html(self.html())
        with patch.object(images,'MAX_HTML',10):
            with self.assertRaises(ValueError):app.sanitize_email_html('x'*11)

    def test_upload_and_eml_endpoints(self):
        client,_=self.authenticated_client()
        uploaded=self.json_request(client,'/api/email/images','POST',{'content_base64':base64.b64encode(png()).decode()})
        self.assertEqual(uploaded['width'],240);self.assertTrue(uploaded['src'].startswith('data:image/png;'))
        message=self.assert_mime(self.eml_request(client,self.html()*2))
        self.assertEqual(str(message['Subject']),'Überprüfung')
        self.assertEqual(str(message['To']),'kunde@example.test')
        self.assertEqual(str(message['Cc']),'copy@example.test')
        self.assert_mime(self.eml_request(client,'<p>fett ohne Bild</p>'),count=0)

    def test_bad_upload_and_bad_eml_return_400(self):
        client,_=self.authenticated_client()
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.json_request(client,'/api/email/images','POST',{'content_base64':'not base64!'})
        self.assertEqual(error.exception.code,400)
        with self.assertRaises(urllib.error.HTTPError) as error:self.eml_request(client,'<img src="data:image/png;base64,AAAA">')
        self.assertEqual(error.exception.code,400)

    def test_auth_csrf_and_permissions(self):
        client,_=self.new_client()
        with self.assertRaises(urllib.error.HTTPError) as error:
            client.open(urllib.request.Request(self.base_url+'/api/email/images',data=b'{}',headers={'Content-Type':'application/json'}))
        self.assertIn(error.exception.code,[401,403])
        client,_=self.authenticated_client()
        with self.assertRaises(urllib.error.HTTPError) as error:
            client.open(urllib.request.Request(self.base_url+'/api/email/eml',data=b'{}',headers={'Content-Type':'application/json'}))
        self.assertEqual(error.exception.code,403)
        with patch.object(app,'permissions_from_row',return_value=[]):
            for endpoint in ['/api/email/images','/api/email/eml']:
                with self.assertRaises(urllib.error.HTTPError) as error:self.json_request(client,endpoint,'POST',{})
                self.assertEqual(error.exception.code,403)

    def test_template_exports_versions_and_project_snapshot(self):
        client,_=self.authenticated_client()
        category=self.json_request(client,'/api/categories')['categories'][0]['id']
        created=self.json_request(client,'/api/templates','POST',{'name':'Bildvorlage','category_id':category,'subject':'Bilder','body_html':self.html(),'fields':[]})
        tid=created['id'];export=self.json_request(client,f'/api/templates/{tid}/export/json')['template']
        self.assertIn('data:image/png;',export['body_html'])
        self.assert_mime(client.open(self.base_url+f'/api/templates/{tid}/export/eml').read())
        with zipfile.ZipFile(io.BytesIO(client.open(self.base_url+'/api/templates/export/eml').read())) as archive:
            name=next(name for name in archive.namelist() if 'Bildvorlage' in name)
            self.assert_mime(archive.read(name))
        self.json_request(client,f'/api/templates/{tid}','PUT',{'name':'Bildvorlage neu','category_id':category,'subject':'Bilder','body_html':self.html(),'fields':[]})
        with app.db() as conn:
            versions=conn.execute('SELECT snapshot_json FROM template_versions WHERE template_id=?',(tid,)).fetchall()
            self.assertEqual(len(versions),2)
            self.assertTrue(all('data:image/png;' in json.loads(row['snapshot_json'])['body_html'] for row in versions))
        self.json_request(client,'/api/projects','POST',{'data':{'schema_version':'1.0','projekt':{'id':'IMAGE-PROJECT','bezeichnung':'Bildprojekt'},'kontakte':[]}})
        project=next(p for p in self.json_request(client,'/api/projects')['projects'] if p['project_key']=='IMAGE-PROJECT')
        self.json_request(client,f'/api/projects/{project["id"]}/emails','POST',{'template_id':tid,'subject':'Bildsnapshot','body_html':self.html()})
        saved=self.json_request(client,f'/api/projects/{project["id"]}/workspace')['emails'][0]
        self.assertIn('data:image/png;',saved['body_html'])
        self.assert_mime(self.eml_request(client,saved['body_html']))


if __name__=='__main__':unittest.main()
