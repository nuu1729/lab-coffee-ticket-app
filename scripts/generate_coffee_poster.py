from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import math
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import A4

W, H = 2480, 3508  # A4 at 300dpi
BASE = Path('/home/ubuntu/lab-coffee-ticket-app')
PUBLIC_OUT = BASE / 'docs' / 'poster_public_github_safe.png'
PUBLIC_PDF = BASE / 'docs' / 'poster_public_github_safe.pdf'
PRIVATE_DIR = Path('/home/ubuntu/private_poster_outputs')
PRIVATE_OUT = PRIVATE_DIR / 'poster_internal_real_qr.png'
PRIVATE_PDF = PRIVATE_DIR / 'poster_internal_real_qr.pdf'
APP_QR = Path('/home/ubuntu/upload/qr-code-HPNo2yQdNQM-(1).png')
PAYPAY_QR = Path('/home/ubuntu/upload/Image.jpg')

for p in [PUBLIC_OUT.parent, PRIVATE_DIR]:
    p.mkdir(parents=True, exist_ok=True)

COLORS = {
    'cream': '#F5EFE4',
    'dark_green': '#1E4D3A',
    'green': '#2E6B50',
    'brown': '#4E3427',
    'light_brown': '#8B5E3C',
    'gold': '#C9A46A',
    'charcoal': '#2C2A28',
    'muted': '#6B625C',
    'white': '#FFFFFF',
    'soft_panel': '#FBF7F0',
    'line': '#D7CCBC',
    'dummy': '#E7DED0',
}

FONT_SANS = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FONT_SANS_BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
FONT_SERIF = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc'
FONT_SERIF_BOLD = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'


def font(path, size):
    return ImageFont.truetype(path, size)


def draw_centered(draw, xy, text, fnt, fill):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    x = xy[0] - (bbox[2] - bbox[0]) / 2
    y = xy[1] - (bbox[3] - bbox[1]) / 2
    draw.text((x, y), text, font=fnt, fill=fill)


def fit_text(draw, text, path, max_size, min_size, max_width):
    size = max_size
    while size >= min_size:
        fnt = font(path, size)
        bbox = draw.textbbox((0, 0), text, font=fnt)
        if bbox[2] - bbox[0] <= max_width:
            return fnt
        size -= 2
    return font(path, min_size)


def rounded_panel(base, box, radius, fill, outline=None, width=2):
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_background():
    img = Image.new('RGB', (W, H), COLORS['cream'])
    d = ImageDraw.Draw(img)

    # Top deep green header block
    d.rectangle([0, 0, W, 760], fill=COLORS['dark_green'])
    d.rectangle([0, 700, W, 820], fill=COLORS['green'])

    # Warm radial glow around cup zone
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r, a in [(900, 35), (760, 50), (620, 65), (500, 80), (360, 100)]:
        gd.ellipse([W//2-r, 900-r, W//2+r, 900+r], fill=(201, 164, 106, a))
    img = Image.alpha_composite(img.convert('RGBA'), glow).convert('RGB')
    d = ImageDraw.Draw(img)

    # Subtle bean pattern in lower area
    for i in range(24):
        x = 100 + (i % 6) * 390 + (35 if (i//6)%2 else 0)
        y = 2360 + (i // 6) * 210
        d.ellipse([x, y, x+110, y+150], outline=COLORS['line'], width=4)
        d.arc([x+28, y+18, x+82, y+132], start=260, end=100, fill=COLORS['line'], width=4)

    # Soft cream lower block
    d.rectangle([0, 820, W, H], fill=COLORS['cream'])

    # Reapply subtle top gradient separator
    for i in range(200):
        alpha_col = tuple(int((1 - i/200) * c + (i/200) * 245) for c in (30, 77, 58))
        d.line([(0, 820 + i), (W, 820 + i)], fill=alpha_col, width=1)

    return img


def draw_cup(img):
    d = ImageDraw.Draw(img)

    # shadow
    d.ellipse([820, 1330, 1660, 1450], fill='#D8C9B3')

    # saucer
    d.rounded_rectangle([840, 1260, 1640, 1360], radius=50, fill='#EEE5D8', outline=COLORS['line'], width=5)
    d.rounded_rectangle([930, 1210, 1550, 1300], radius=40, fill='#F8F4EC', outline=COLORS['line'], width=4)

    # cup body
    d.rounded_rectangle([980, 880, 1520, 1240], radius=50, fill=COLORS['white'], outline='#DCCFBF', width=6)
    d.arc([1450, 940, 1660, 1160], start=270, end=90, fill='#DCCFBF', width=26)
    d.arc([1490, 970, 1620, 1130], start=270, end=90, fill=COLORS['white'], width=16)

    # coffee surface
    d.rounded_rectangle([1015, 910, 1485, 995], radius=36, fill='#6A412C')
    d.rounded_rectangle([1045, 930, 1455, 980], radius=25, fill='#7A4C33')

    # simple emblem circle
    d.ellipse([1190, 1000, 1310, 1120], fill=COLORS['dark_green'])
    d.ellipse([1225, 1035, 1275, 1085], fill=COLORS['cream'])

    # beans near base
    bean_positions = [(860, 1280), (920, 1310), (1540, 1285), (1600, 1320), (1000, 1320), (1460, 1320)]
    for x, y in bean_positions:
        d.ellipse([x, y, x+52, y+72], fill=COLORS['brown'])
        d.arc([x+10, y+10, x+42, y+62], start=260, end=100, fill='#A97B57', width=3)

    # steam
    steam = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(steam)
    for offset, width in [(-110, 18), (-35, 16), (55, 14), (135, 12)]:
        pts = []
        for t in range(0, 260):
            x = W//2 + offset + math.sin(t/28) * 36 + math.sin(t/13) * 8
            y = 860 - t * 2.0
            pts.append((x, y))
        sd.line(pts, fill=(255, 255, 255, 120), width=width)
    steam = steam.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(steam)


def wrap_text(text, max_chars):
    lines = []
    buf = ''
    for ch in text:
        buf += ch
        if len(buf) >= max_chars and ch in '、。・ ':
            lines.append(buf.strip())
            buf = ''
    if buf:
        lines.append(buf.strip())
    return '\n'.join(lines)


def paste_qr(base, qr_path, box, public_dummy=False):
    x1, y1, x2, y2 = box
    size = min(x2 - x1, y2 - y1)
    if public_dummy:
        qr = Image.new('RGB', (size, size), COLORS['dummy'])
        d = ImageDraw.Draw(qr)
        d.rectangle([0, 0, size-1, size-1], fill=COLORS['white'], outline=COLORS['line'], width=8)
        # finder-like squares
        for ox, oy in [(36, 36), (size-196, 36), (36, size-196)]:
            d.rectangle([ox, oy, ox+160, oy+160], outline=COLORS['charcoal'], width=14)
            d.rectangle([ox+34, oy+34, ox+126, oy+126], fill=COLORS['charcoal'])
        # central diagonal bars
        for i in range(-size, size, 36):
            d.line([(i, 0), (i + size, size)], fill=COLORS['line'], width=10)
        f = fit_text(d, 'DUMMY', FONT_SANS_BOLD, 92, 46, size - 100)
        draw_centered(d, (size/2, size/2), 'DUMMY', f, COLORS['brown'])
    else:
        qr = Image.open(qr_path).convert('RGB')
        if Path(qr_path) == PAYPAY_QR:
            w, h = qr.size
            qr = qr.crop((0, 0, w, int(h * 0.78)))
            bg = Image.new('RGB', (w, w), COLORS['white'])
            qrw, qrh = qr.size
            yoff = max(0, (w - qrh) // 2 - 10)
            bg.paste(qr, (0, yoff))
            qr = bg
        qr = qr.resize((size, size))
    base.paste(qr, (x1, y1))


def build_poster(public_version=True):
    img = make_background().convert('RGBA')
    draw = ImageDraw.Draw(img)
    draw_cup(img)
    draw = ImageDraw.Draw(img)

    # Header texts
    f_small = font(FONT_SANS, 52)
    f_title = fit_text(draw, 'LAB COFFEE TICKET', FONT_SERIF_BOLD, 170, 110, W - 240)
    f_sub = font(FONT_SANS, 60)
    f_copy = font(FONT_SERIF, 74)
    f_body = font(FONT_SANS, 45)
    f_body_bold = font(FONT_SANS_BOLD, 46)
    f_label = font(FONT_SANS_BOLD, 42)
    f_tiny = font(FONT_SANS, 34)
    f_price = font(FONT_SANS_BOLD, 46)
    f_price_item = font(FONT_SANS, 40)

    draw.text((150, 80), 'ARTIFACT DESIGN ENGINEERING LABORATORY', font=f_small, fill='#D7E8DF')
    draw.text((150, 155), '研究室コーヒー販売のご案内', font=f_sub, fill=COLORS['cream'])
    title_bbox = draw.textbbox((0, 0), 'LAB COFFEE TICKET', font=f_title)
    draw.text((150, 245), 'LAB COFFEE TICKET', font=f_title, fill=COLORS['white'])
    draw.text((150, 460), '研究室で楽しむ一杯を、スマートに。', font=f_copy, fill='#F2E6D2')
    desc = 'アプリから購入申請し、支払確認後にチケットを配布します。\n現金にもPayPayにも対応した、研究室向けのコーヒーチケット運用です。'
    draw.multiline_text((150, 565), desc, font=f_body, fill='#E5F0EA', spacing=10)

    # Middle info panel
    rounded_panel(img, [110, 1500, W-110, H-130], 42, COLORS['soft_panel'], outline=COLORS['line'], width=4)
    draw = ImageDraw.Draw(img)
    draw.text((170, 1565), 'HOW TO USE', font=f_body_bold, fill=COLORS['dark_green'])
    draw.text((910, 1565), 'PRICE', font=f_body_bold, fill=COLORS['dark_green'])

    steps = [
        '1. QRコードを読み取り Manus アカウントにサインイン・ログイン',
        '2. アカウント名を登録',
        '3. 購入申請を送る',
        '4. 支払方法を選ぶ（現金 or PayPay）',
        '5. 支払確認後、チケット配布',
    ]
    y = 1650
    for s in steps:
        draw.rounded_rectangle([170, y, 820, y+92], radius=24, fill=COLORS['white'], outline=COLORS['line'], width=2)
        draw.text((198, y+20), s, font=font(FONT_SANS, 34), fill=COLORS['charcoal'])
        y += 108

    # Price table
    px1, py1, px2 = 910, 1640, W-170
    draw.rounded_rectangle([px1, py1, px2, py1+250], radius=28, fill=COLORS['white'], outline=COLORS['line'], width=2)
    draw.line([(px1+40, py1+88), (px2-40, py1+88)], fill=COLORS['line'], width=2)
    draw.line([(px1+40, py1+170), (px2-40, py1+170)], fill=COLORS['line'], width=2)
    draw.text((px1+40, py1+24), 'まとめ買い', font=f_price_item, fill=COLORS['brown'])
    draw.text((px2-40-draw.textbbox((0,0), '10枚500円、24枚1000円', font=f_price)[2], py1+20), '10枚500円、24枚1000円', font=f_price, fill=COLORS['dark_green'])
    draw.text((px1+40, py1+104), '即時買い', font=f_price_item, fill=COLORS['brown'])
    draw.text((px2-40-draw.textbbox((0,0), '1枚、70円', font=f_price)[2], py1+100), '1枚、70円', font=f_price, fill=COLORS['dark_green'])
    draw.text((px1+40, py1+186), '支払方法', font=f_price_item, fill=COLORS['brown'])
    draw.text((px2-40-draw.textbbox((0,0), '現金 or PayPay', font=f_price)[2], py1+182), '現金 or PayPay', font=f_price, fill=COLORS['dark_green'])

    # Bean usage block
    usage_box = [910, 1915, W-170, 2145]
    draw.rounded_rectangle(usage_box, radius=28, fill='#F2ECE2', outline=COLORS['line'], width=2)
    usage = '1枚 = 10g のコーヒー豆\n何枚かまとめての利用が可能です。例：30g の利用なら 3枚使用してください。\n目安 10g / 人'
    draw.multiline_text((950, 1960), usage, font=font(FONT_SANS, 38), fill=COLORS['charcoal'], spacing=10)

    # QR labels and frames
    draw.text((170, 2195), 'SCAN & APPLY', font=f_body_bold, fill=COLORS['dark_green'])
    draw.text((1280, 2195), 'PAYMENT', font=f_body_bold, fill=COLORS['dark_green'])

    left_box = [170, 2260, 980, 3200]
    right_box = [1280, 2260, 2090, 3200]
    draw.rounded_rectangle(left_box, radius=34, fill=COLORS['white'], outline=COLORS['line'], width=2)
    draw.rounded_rectangle(right_box, radius=34, fill=COLORS['white'], outline=COLORS['line'], width=2)

    draw.text((220, 2315), '申請はこちら', font=f_label, fill=COLORS['brown'])
    draw.text((1330, 2315), 'PayPay送金はこちら' if not public_version else 'PayPay案内', font=f_label, fill=COLORS['brown'])

    paste_qr(img, APP_QR, [255, 2395, 895, 3035], public_dummy=False)
    paste_qr(img, PAYPAY_QR, [1365, 2395, 2005, 3035], public_dummy=public_version)

    app_note = 'アプリを開き、ログイン後に購入申請を送ってください。'
    draw.multiline_text((220, 3065), wrap_text(app_note, 26), font=f_tiny, fill=COLORS['muted'], spacing=6)

    if public_version:
        pay_note = 'GitHub公開版です。\nPayPay QRは研究室掲示版をご利用ください。'
    else:
        pay_note = '一度支払い後に連絡先登録すると、\n以後はPayPay側から送金しやすくなります。'
    draw.multiline_text((1330, 3065), pay_note, font=f_tiny, fill=COLORS['muted'], spacing=6)

    # footer
    draw.line([(150, 3290), (W-150, 3290)], fill=COLORS['line'], width=2)
    draw.text((150, 3320), '人工物設計工学研究室', font=font(FONT_SANS_BOLD, 42), fill=COLORS['dark_green'])
    draw.text((W-150-draw.textbbox((0,0), '問い合わせ先：武田まで  sc223024@cse.oka-pu.ac.jp', font=f_tiny)[2], 3328),
              '問い合わせ先：武田まで  sc223024@cse.oka-pu.ac.jp', font=f_tiny, fill=COLORS['muted'])

    return img.convert('RGB')


def save_pdf_from_image(image_path: Path, pdf_path: Path):
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    page_w, page_h = A4
    c.drawImage(ImageReader(str(image_path)), 0, 0, width=page_w, height=page_h, preserveAspectRatio=True, mask='auto')
    c.showPage()
    c.save()



def main():
    public_img = build_poster(public_version=True)
    public_img.save(PUBLIC_OUT, quality=95)
    save_pdf_from_image(PUBLIC_OUT, PUBLIC_PDF)

    private_img = build_poster(public_version=False)
    private_img.save(PRIVATE_OUT, quality=95)
    save_pdf_from_image(PRIVATE_OUT, PRIVATE_PDF)

    print(str(PUBLIC_OUT))
    print(str(PUBLIC_PDF))
    print(str(PRIVATE_OUT))
    print(str(PRIVATE_PDF))


if __name__ == '__main__':
    main()
