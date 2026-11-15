"""DOCX inspection and lazy text blocks shared by preview and generation."""
import io
import re
import zipfile
from xml.etree import ElementTree
from jinja2 import StrictUndefined, meta, nodes
from jinja2.sandbox import SandboxedEnvironment


class DocumentEnvironment(SandboxedEnvironment):
    def getattr(self, obj, attribute):
        # Dictionary fields such as "items" remain user data, not dict methods.
        if isinstance(obj, dict):
            try: return obj[attribute]
            except KeyError: return self.undefined(obj=obj,name=attribute)
        return super().getattr(obj, attribute)


def template_environment(autoescape=False):
    return DocumentEnvironment(undefined=StrictUndefined, autoescape=autoescape)


def docx_source(raw):
    if not raw or len(raw)>10_000_000:
        raise ValueError("Bitte eine DOCX-Datei mit höchstens 10 MB verwenden.")
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            if 'word/document.xml' not in archive.namelist(): raise ValueError("Kein Word-Dokument gefunden.")
            if sum(entry.file_size for entry in archive.infolist())>40_000_000: raise ValueError("Die entpackte Word-Datei ist zu groß.")
            paragraphs=[]
            for name in archive.namelist():
                if re.fullmatch(r'word/(document|header\d+|footer\d+|footnotes|endnotes)\.xml',name):
                    tree=ElementTree.fromstring(archive.read(name))
                    ns='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                    paragraphs.extend(''.join(element.text or '' for element in paragraph.iter(ns+'t')) for paragraph in tree.iter(ns+'p'))
            return '\n'.join(paragraphs)
    except (zipfile.BadZipFile, ElementTree.ParseError, KeyError) as exc:
        raise ValueError("Die Datei ist keine gültige DOCX-Vorlage.") from exc


def expression_keys(source):
    """Read actual Jinja variables, ignoring quoted examples and loop aliases."""
    normalized=re.sub(r'\{%\s*(?:p|tr|tc|r)\s+', '{% ', source)
    normalized=re.sub(r'\{\{r\s+', '{{ ', normalized)
    tree=template_environment().parse(normalized)
    roots=meta.find_undeclared_variables(tree)
    keys=set()
    def path(node):
        if isinstance(node,nodes.Name): return node.name
        if isinstance(node,nodes.Getattr):
            prefix=path(node.node)
            return f'{prefix}.{node.attr}' if prefix else None
        if isinstance(node,nodes.Getitem) and isinstance(node.arg,nodes.Const) and isinstance(node.arg.value,str):
            prefix=path(node.node)
            return f'{prefix}.{node.arg.value}' if prefix else None
        return None
    for node in tree.find_all((nodes.Getattr,nodes.Getitem,nodes.Name)):
        key=path(node)
        if key and key.split('.')[0] in roots: keys.add(key)
    return sorted(key for key in keys if not any(other.startswith(key+'.') for other in keys))


def inspect_template(raw, blocks, catalog):
    source=docx_source(raw)
    warnings=[]
    try: direct=expression_keys(source)
    except Exception as exc:
        return {'placeholders':[], 'blocks':[], 'warnings':[f'Vorlagensyntax prüfen: {exc}'], 'syntax_valid':False}
    by_key={row['block_key']:row for row in blocks if row['active']}
    known={row['key'] for row in catalog if row['active']}
    fields=set();used=set();valid=True
    def visit(keys, chain=()):
        nonlocal valid
        for key in keys:
            if not key.startswith('baustein.'):
                fields.add(key);continue
            block_key=key.split('.',1)[1]
            if block_key in chain or len(chain)>=20:
                warnings.append(f'Zyklische oder zu tiefe Textbaustein-Verknüpfung: {" → ".join((*chain,block_key))}');valid=False;continue
            if block_key in used:continue
            used.add(block_key)
            block=by_key.get(block_key)
            if not block:
                warnings.append(f'Textbaustein fehlt oder ist inaktiv: {block_key}');valid=False;continue
            try: visit(expression_keys(block['content']),(*chain,block_key))
            except Exception as exc:
                warnings.append(f'Textbaustein „{block["name"]}“ prüfen: {exc}');valid=False
    visit(direct)
    for key in sorted(fields):
        if key not in known and key!='kontakte' and not key.startswith('benutzer.'):
            warnings.append(f'Platzhalter nicht im Katalog: {key}. Er kann manuell ausgefüllt werden.')
    return {'placeholders':sorted(fields), 'blocks':sorted(used), 'warnings':warnings, 'syntax_valid':valid}


class LazyBlocks(dict):
    """Render only blocks actually reached by Jinja, including conditional ones.

    Block strings stay unescaped here; DOCX rendering escapes them exactly once
    at insertion. Missing data in unrelated blocks cannot break this document.
    """
    def __init__(self, rows, context):
        super().__init__()
        self.rows={row['block_key']:row for row in rows if row['active']}
        self.context=context
        self.resolving=[]

    def __missing__(self,key):
        if key in self.resolving or len(self.resolving)>=20:
            raise ValueError('Textbausteine verweisen im Kreis oder sind zu tief verschachtelt: '+' → '.join((*self.resolving,key)))
        row=self.rows.get(key)
        if row is None:raise KeyError(key)
        self.resolving.append(key)
        try:
            value=template_environment().from_string(row['content']).render(self.context)
            self[key]=value
            return value
        except Exception as exc:
            raise ValueError(f'Textbaustein „{row["name"]}“: {exc}') from exc
        finally:
            self.resolving.pop()
