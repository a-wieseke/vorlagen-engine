"""Validated inline images and MIME export for email templates.

Images live inside the sanitized HTML as data URLs. This deliberately keeps
snapshots, JSON exports and SQLite backups self-contained, without orphan files.
EML output replaces them with CID references and related MIME parts.
"""
import base64
import hashlib
import html
import io
import re
import warnings
from email.message import EmailMessage
from email.policy import SMTP
from functools import lru_cache
from PIL import Image, ImageOps

MAX_UPLOAD = 8_000_000
MAX_IMAGE = 2_000_000
MAX_PIXELS = 20_000_000
MAX_EDGE = 1600
MAX_IMAGES = 10
MAX_TOTAL = 4_000_000
MAX_HTML = 6_500_000
DATA_URL = re.compile(r"^data:image/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$", re.I)


def normalize_image(raw):
    """Decode actual pixels, orient, resize, and re-encode without metadata."""
    if not raw or len(raw) > MAX_UPLOAD:
        raise ValueError("Bitte ein PNG- oder JPG-Bild mit höchstens 8 MB auswählen.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as source:
                if source.format not in {"PNG", "JPEG"}:
                    raise ValueError("Nur PNG und JPG werden unterstützt.")
                if source.width * source.height > MAX_PIXELS:
                    raise ValueError("Das Bild darf höchstens 20 Millionen Pixel enthalten.")
                source.load()
                oriented = ImageOps.exif_transpose(source)
                alpha = source.format == "PNG" and ("A" in oriented.getbands() or "transparency" in oriented.info)
                # A new pixel-only image strips EXIF, GPS, comments and profiles.
                pixels = oriented.convert("RGBA" if alpha else "RGB")
                pixels.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
                clean = Image.new(pixels.mode, pixels.size)
                clean.paste(pixels)
                # Canonical PNG avoids cumulative JPEG recompression when an
                # existing template is saved/exported repeatedly.
                for _ in range(8):
                    stream = io.BytesIO()
                    clean.save(stream, format="PNG", optimize=True)
                    content = stream.getvalue()
                    if len(content) <= MAX_IMAGE:
                        return content, "png", clean.width, clean.height
                    clean = clean.resize((max(1,int(clean.width*.75)),max(1,int(clean.height*.75))),Image.Resampling.LANCZOS)
                raise ValueError("Das Bild konnte nicht ausreichend verkleinert werden.")
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Das Bild ist beschädigt, zu groß oder kein gültiges PNG/JPG.") from exc


@lru_cache(maxsize=8)
def validated_image_url(value):
    """Small cache avoids repeated decoding of the same versioned image."""
    match = DATA_URL.fullmatch(value)
    if not match or len(value) > 11_000_000:
        raise ValueError("Ungültige Bilddaten. Bitte über „Bild einfügen“ hochladen.")
    try: raw = base64.b64decode(match.group(2), validate=False)
    except Exception as exc: raise ValueError("Die Bilddaten konnten nicht gelesen werden.") from exc
    return normalize_image(raw)


def data_url(content, subtype):
    return f"data:image/{subtype};base64," + base64.b64encode(content).decode("ascii")


def image_tag(attrs, budget):
    """Permit only local, verified PNG/JPG pixels and bounded size/alt attributes."""
    attrs = dict(attrs)
    src = str(attrs.get("src") or "")
    if not src.lower().startswith("data:image/"):
        return ""  # Remote URLs, SVG, file:, blob: and imported CID references are not trusted.
    raw, subtype, width, height = validated_image_url(src)
    budget["count"] += 1
    budget["bytes"] += len(raw)
    if budget["count"] > MAX_IMAGES or budget["bytes"] > MAX_TOTAL:
        raise ValueError("Pro E-Mail sind höchstens 10 Bilder mit zusammen 4 MB erlaubt.")
    try: display_width = int(attrs.get("width") or min(width,600))
    except (ValueError,TypeError): display_width = min(width,600)
    display_width = max(1,min(display_width,width,MAX_EDGE))
    display_height = max(1,round(height * display_width / width))
    alt = html.escape(str(attrs.get("alt") or "Bild")[:300],quote=True)
    return f'<img src="{data_url(raw,subtype)}" alt="{alt}" width="{display_width}" height="{display_height}">'


def build_eml(subject, body_text, body_html, recipient="", cc=""):
    """HTML + plain-text alternative; images belong to the HTML related part."""
    message = EmailMessage(policy=SMTP)
    header = lambda value: re.sub(r"[\r\n\x00-\x1f]+"," ",str(value or "")).strip()
    message["X-Unsent"] = "1"
    message["Subject"] = header(subject)
    if recipient: message["To"] = header(recipient)
    if cc: message["Cc"] = header(cc)
    parts = {}
    def embedded(match):
        src = html.unescape(match.group(1))
        decoded = DATA_URL.fullmatch(src)
        if not decoded: return match.group(0)
        # The caller always sanitizes first; keep the exact validated bytes.
        content = base64.b64decode(decoded.group(2))
        # Keep Content-ID below the header fold limit. Long IDs may otherwise
        # become RFC 2047 encoded words, which Outlook cannot reliably resolve.
        cid = hashlib.sha256(content).hexdigest()[:32] + "@wieseke.inline"
        parts[cid] = (content,decoded.group(1).lower())
        return f'src="cid:{cid}"'
    body_html = re.sub(r'src="(data:image/(?:png|jpeg);base64,[^"]+)"',embedded,body_html)
    document = f'<!doctype html><html><head><meta charset="UTF-8"></head><body>{body_html}</body></html>'
    message.set_content(str(body_text or ""),charset="utf-8")
    message.add_alternative(document,subtype="html",charset="utf-8")
    related = message.get_payload()[-1]
    for index,(cid,(content,subtype)) in enumerate(parts.items(),1):
        related.add_related(content,maintype="image",subtype=subtype,cid=f"<{cid}>",
                            disposition="inline",filename=f"bild-{index}.{'jpg' if subtype=='jpeg' else 'png'}")
    return message.as_bytes(policy=SMTP)

