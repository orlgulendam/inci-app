# scripts/generate_pdf.py
# INCI Engine projesinin tüm veri setlerini, boru hattını ve kritik kodlarını içeren resmi PDF raporunu üretir.
import os
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors

# 1) Türkçe Destekli Fontları Kaydet
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Italic', 'C:/Windows/Fonts/ariali.ttf'))

PDF_PATH = 'data/INCI-Engine-Veri-Seti-ve-Mimari-Rehberi.pdf'

doc = SimpleDocTemplate(
    PDF_PATH,
    pagesize=A4,
    leftMargin=36,
    rightMargin=36,
    topMargin=40,
    bottomMargin=40
)

# 2) Özel Stiller
styles = getSampleStyleSheet()

primary_color = colors.HexColor('#1E3A8A')    # Koyu Lacivert
secondary_color = colors.HexColor('#2563EB')  # Mavi
accent_color = colors.HexColor('#059669')     # Zümrüt Yeşili
dark_neutral = colors.HexColor('#1F2937')     # Koyu Gri
light_bg = colors.HexColor('#F3F4F6')         # Açık Gri Arka Plan
code_bg = colors.HexColor('#1E293B')          # Kod Arka Planı

title_style = ParagraphStyle(
    'DocTitle',
    fontName='Arial-Bold',
    fontSize=22,
    leading=26,
    textColor=primary_color,
    spaceAfter=6
)

subtitle_style = ParagraphStyle(
    'DocSubTitle',
    fontName='Arial',
    fontSize=13,
    leading=17,
    textColor=secondary_color,
    spaceAfter=15
)

h1_style = ParagraphStyle(
    'Heading1',
    fontName='Arial-Bold',
    fontSize=14,
    leading=18,
    textColor=primary_color,
    spaceBefore=14,
    spaceAfter=8,
    keepWithNext=True
)

h2_style = ParagraphStyle(
    'Heading2',
    fontName='Arial-Bold',
    fontSize=11,
    leading=15,
    textColor=secondary_color,
    spaceBefore=10,
    spaceAfter=4,
    keepWithNext=True
)

body_style = ParagraphStyle(
    'Body',
    fontName='Arial',
    fontSize=9.5,
    leading=13.5,
    textColor=dark_neutral,
    spaceAfter=6
)

bullet_style = ParagraphStyle(
    'Bullet',
    fontName='Arial',
    fontSize=9.5,
    leading=13.5,
    textColor=dark_neutral,
    leftIndent=15,
    spaceAfter=4
)

quote_style = ParagraphStyle(
    'Quote',
    fontName='Arial-Italic',
    fontSize=9.5,
    leading=14,
    textColor=colors.HexColor('#0F172A'),
    backColor=colors.HexColor('#E0F2FE'),
    borderColor=colors.HexColor('#0284C7'),
    borderWidth=1,
    borderPadding=8,
    spaceBefore=6,
    spaceAfter=10,
    borderRadius=4
)

code_style = ParagraphStyle(
    'CodeBlock',
    fontName='Courier',
    fontSize=8,
    leading=10.5,
    textColor=colors.HexColor('#F8FAFC'),
    backColor=code_bg,
    borderPadding=6,
    spaceBefore=4,
    spaceAfter=8,
    borderRadius=4
)

table_header_style = ParagraphStyle(
    'TableHeader',
    fontName='Arial-Bold',
    fontSize=9,
    leading=12,
    textColor=colors.white
)

table_cell_style = ParagraphStyle(
    'TableCell',
    fontName='Arial',
    fontSize=8.5,
    leading=11.5,
    textColor=dark_neutral
)

table_cell_bold = ParagraphStyle(
    'TableCellBold',
    fontName='Arial-Bold',
    fontSize=8.5,
    leading=11.5,
    textColor=dark_neutral
)

# 3) Doküman Akışını (Story) İnşa Et
story = []

# Başlık
story.append(Paragraph('INCI Engine: Kozmetik İçerik Analiz Sistemi', title_style))
story.append(Paragraph('Uçtan Uca Veri Seti Mimarisi, Regülasyon Boru Hattı ve Teknik Başvuru Rehberi', subtitle_style))
story.append(HRFlowable(width='100%', thickness=2, color=primary_color, spaceAfter=12))

# Bölüm 1: Büyük Resim
story.append(Paragraph('1. Büyük Resim ve Projenin Amacı', h1_style))
story.append(Paragraph(
    'Kozmetik ürün etiketlerindeki içerik listeleri (INCI); kimyasal formüller, Latince bitkisel isimler ve teknik kısaltmalarla doludur. '
    'Sıradan bir tüketicinin bu maddelerin güvenli olup olmadığını, Avrupa Birliği yasaklı veya kısıtlı listelerine girip girmediğini anlaması imkansızdır. '
    '<b>INCI Engine</b>, 77.000+ gerçek ürün verisi ile Avrupa Birliği\'nin resmi kozmetik mevzuatını (EC No 1223/2009) birleştiren, '
    'kullanıcı ürün adı yazdığında veya kutunun fotoğrafını çektiğinde her bir içeriği Türkçe açıklaması ve güvenlik rozetiyle (Yasaklı, Kısıtlı, Alerjen, Güvenli) '
    'sunan uçtan uca bir analiz motorudur.',
    body_style
))

# Bölüm 2: Veri Setleri Tablosu
story.append(Paragraph('2. Kullanılan Veri Setleri', h1_style))

dataset_data = [
    [Paragraph('Veri Seti', table_header_style), Paragraph('Kaynak', table_header_style), Paragraph('Boyut / Kayıt', table_header_style), Paragraph('Projedeki Görevi', table_header_style)],
    [Paragraph('obf.products', table_cell_bold), Paragraph('Open Beauty Facts (MongoDB)', table_cell_style), Paragraph('77.622 Ürün', table_cell_style), Paragraph('Piyasadaki ürünlerin etiketleri, barkodları ve ham içerik listeleri', table_cell_style)],
    [Paragraph('glossary.json', table_cell_bold), Paragraph('AB Resmi Gazetesi (2025/1175)', table_cell_style), Paragraph('30.418 Madde', table_cell_style), Paragraph('Avrupa Birliği resmi kozmetik INCI isimlendirme sözlüğü omurgası', table_cell_style)],
    [Paragraph('annex3.txt', table_cell_bold), Paragraph('AB Regülasyonu 1223/2009', table_cell_style), Paragraph('Ek III, IV, V, VI', table_cell_style), Paragraph('Ek III (Kısıtlılar & Alerjenler), Ek IV (Boyalar), Ek V (Koruyucular), Ek VI (UV Filtreleri)', table_cell_style)],
    [Paragraph('annex2.csv + CMR', table_cell_bold), Paragraph('AB CosIng + Omnibus', table_cell_style), Paragraph('1.390 Yasaklı', table_cell_style), Paragraph('Ek II (Kozmetikte tamamen yasaklanmış maddeler; Lilial, Lyral, Çinko Pirition vb.)', table_cell_style)],
    [Paragraph('cosing-inventory.csv', table_cell_bold), Paragraph('AB CosIng Veritabanı', table_cell_style), Paragraph('24.078 Madde', table_cell_style), Paragraph('Her kimyasalın resmi görevleri (Fonksiyonları: Nemlendirici, Antioksidan vb.) ve CAS numaraları', table_cell_style)]
]

t_datasets = Table(dataset_data, colWidths=[95, 125, 80, 220])
t_datasets.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), primary_color),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, light_bg]),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]))
story.append(t_datasets)
story.append(Spacer(1, 10))

# Bölüm 3: Boru Hattı Aşamaları
story.append(Paragraph('3. Veri Boru Hattı ve Aşama Aşama Yapılanlar', h1_style))

stages = [
    ('Adım 1: Ürünlerden Frekans Çıkarma (01-freq.js)',
     'MongoDB\'deki 77 bin ürünün etiketleri tarandı. Kimyasal isimlerdeki virgülleri koruyan özel ayrıştırıcı yazıldı. En az 3 kez (TR\'de 2 kez) geçen içerikler <b>freq.json</b> olarak kaydedildi.'),
    ('Adım 2: Resmi AB Sözlüğünü Çözümleme (02-parse-glossary.js)',
     'AB Komisyonu\'nun en güncel kararı (2025/1175) taranarak 30.418 resmi INCI ismi aksansız arama anahtarlarıyla <b>glossary.json</b> olarak yapılandırıldı.'),
    ('Adım 3: 4 Kademeli Akıllı Eşleştirme (03-merge.js)',
     'Ham ürün içerikleri 4 kademeli arama stratejisiyle (Tam Eşleşme, Parantezsiz, Boşluksuz, Slash bölme) resmi adlara bağlandı. 3.308 doğrulanmış içerik kartı (<b>ingredients.draft.json</b>) üretildi.'),
    ('Adım 4: Ek III-VI Güvenlik ve Regülasyon Bayrakları (04-annex.js)',
     'Kısıtlı maddeler, 26 koku alerjeni, boyalar, koruyucular ve güneş filtreleri işlendi. Çoklu isim ayrıştırması geliştirilerek eşleşmeyen Ek III sayısı <b>227\'den 36\'ya düşürüldü (%90.4 başarı)</b>.'),
    ('Adım 5: Ek II Yasaklı Maddeler ve CMR Güncellemeleri (05-annex2.js)',
     'AB\'de kullanımı yasaklanmış 1.390 madde işlendi. 2021-2024 Omnibus CMR ekleri (Lilial #1666, Lyral #1380, Çinko Pirition #1670 vb.) eklendi. Yasal istisnalar (vazelin ve narenciye özleri muafiyeti) filtrelendi.'),
    ('Adım 6: Türkçe Açıklamalar ve Görev Fonksiyonları (06-functions.js)',
     'CosIng görev envanterinden 40+ fonksiyon Türkçeleştirildi. 150+ popüler aktif için zengin açıklamalar ve tüm diğer maddeler için kural tabanlı doğal Türkçe açıklamalar atandı.')
]

for title, desc in stages:
    story.append(Paragraph(f'<b>• {title}</b>', h2_style))
    story.append(Paragraph(desc, bullet_style))

story.append(Spacer(1, 8))

# Bölüm 4: Kritik Kod Parçacıkları ve Mühendislik Kararları
story.append(Paragraph('4. Kritik Kod Parçacıkları ve Mühendislik Kararları', h1_style))

story.append(Paragraph('A) Kimyasal Virgülleri Koruyan Liste Ayrıştırıcı (splitList)', h2_style))
story.append(Paragraph(
    'Standart virgülle bölme işlemi <i>1,2-hexanediol</i> gibi maddeleri parçalar. Bunu önlemek için derinlik ve rakam kontrolü yapan algoritma geliştirdik:',
    body_style
))

code_p1 = (
    "function splitList(text) {\n"
    "  const parts = []; let depth = 0, cur = '';\n"
    "  for (let i = 0; i &lt; text.length; i++) {\n"
    "    const ch = text[i];\n"
    "    if (ch === '(' || ch === '[') depth++;\n"
    "    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);\n"
    "    // 1,2- rakam virgülünü koru, bölme!\n"
    "    const chemComma = ch === ',' &amp;&amp; /\\d/.test(text[i-1]||'') &amp;&amp; /\\d/.test(text[i+1]||'');\n"
    "    if ((ch === ',' || ch === ';' || ch === '•') &amp;&amp; depth === 0 &amp;&amp; !chemComma) {\n"
    "      parts.push(cur.trim()); cur = '';\n"
    "    } else cur += ch;\n"
    "  }\n"
    "  if (cur.trim()) parts.push(cur.trim());\n"
    "  return parts;\n"
    "}"
)
story.append(Paragraph(code_p1.replace('\n', '<br/>').replace(' ', '&nbsp;'), code_style))

story.append(Paragraph('B) Regülasyondaki Çoklu İsimleri ve İstisnaları Çözme', h2_style))
story.append(Paragraph(
    'Yönetmelik hücrelerinde noktalı virgül (;), taksim (/), artı (+) ve \'and\' bağlacı ile yazılmış çoklu isimleri ayrıştırdık. '
    'Ayrıca furokumarin ve rafine vazelin gibi yasal muafiyetleri kodlayarak yanlış yasaklı (false-positive) işaretlemelerini engelledik:',
    body_style
))

code_p2 = (
    "// Yasal İstisnaların Yönetilmesi (False-Positive Önleme)\n"
    "const isEssenceExcept = chemLower.includes('natural essences'); // Turunçgil yağları yasaklı DEĞİLDİR\n"
    "const isRefiningExcept = chemLower.includes('refining history'); // Kozmetik vazelin yasaklı DEĞİLDİR\n"
    "if (isEssenceExcept &amp;&amp; (k.includes('extract') || k.includes('oil'))) continue;\n"
    "if (isRefiningExcept &amp;&amp; k.includes('petrolatum')) continue;"
)
story.append(Paragraph(code_p2.replace('\n', '<br/>').replace(' ', '&nbsp;'), code_style))

story.append(Spacer(1, 8))

# Bölüm 5: Genel İstatistik Tablosu
story.append(Paragraph('5. Nihai Veritabanı ve Regülasyon İstatistikleri', h1_style))

stats_data = [
    [Paragraph('Regülasyon / Görev Kategorisi', table_header_style), Paragraph('AB Resmi Sözlüğü (30.418 Madde)', table_header_style), Paragraph('Ürün Havuzunuz (3.308 Madde)', table_header_style), Paragraph('Açıklama', table_header_style)],
    [Paragraph('🚫 Yasaklı (Ek II)', table_cell_bold), Paragraph('395 Madde', table_cell_style), Paragraph('10 Madde', table_cell_style), Paragraph('Lilial, Lyral, Çinko Pirition, D4 vb. (Eski formüller)', table_cell_style)],
    [Paragraph('⚠️ Kısıtlı (Ek III)', table_cell_bold), Paragraph('398 Madde', table_cell_style), Paragraph('109 Madde', table_cell_style), Paragraph('Yasal konsantrasyon ve kullanım amacı sınırı olanlar', table_cell_style)],
    [Paragraph('🌸 Koku Alerjeni (Ek III)', table_cell_bold), Paragraph('135 Madde', table_cell_style), Paragraph('90 Madde', table_cell_style), Paragraph('Etikette belirtilmesi zorunlu 26 alerjen ve türevleri', table_cell_style)],
    [Paragraph('🎨 Renklendirici (Ek IV)', table_cell_bold), Paragraph('173 Madde', table_cell_style), Paragraph('81 Madde', table_cell_style), Paragraph('İzinli tüm CI kodlu kozmetik pigmentleri ve boyaları', table_cell_style)],
    [Paragraph('🛡️ Koruyucu (Ek V)', table_cell_bold), Paragraph('123 Madde', table_cell_style), Paragraph('59 Madde', table_cell_style), Paragraph('Mikrop ve küfe karşı izin verilen koruyucular', table_cell_style)],
    [Paragraph('☀️ UV Filtresi (Ek VI)', table_cell_bold), Paragraph('31 Madde', table_cell_style), Paragraph('22 Madde', table_cell_style), Paragraph('Kimyasal ve fiziksel (mineral) güneş filtreleri', table_cell_style)],
    [Paragraph('📝 Türkçe Açıklama', table_cell_bold), Paragraph('30.418 (%100)', table_cell_style), Paragraph('3.308 (%100)', table_cell_style), Paragraph('Tüm maddelere dermatolojik görev ve açıklama atandı', table_cell_style)]
]

t_stats = Table(stats_data, colWidths=[110, 120, 110, 180])
t_stats.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), primary_color),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, light_bg]),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]))
story.append(t_stats)
story.append(Spacer(1, 10))

# Bölüm 6: Sunum ve Mülakat Rehberi
story.append(Paragraph('6. Biri Sorduğunda Nasıl Anlatmalısınız? (İletişim Rehberi)', h1_style))

story.append(Paragraph('🎙️ 30 Saniyelik Asansör Konuşması (Elevator Pitch):', h2_style))
story.append(Paragraph(
    '"Projemizde, piyasadaki 77.000 kozmetik ürünün etiket verilerini Avrupa Birliği\'nin 30.000 maddelik resmi INCI sözlüğü ve '
    'EC 1223/2009 Kozmetik Regülasyonu ile birleştiren akıllı bir analiz motoru geliştirdik. '
    'Kullanıcı mobil uygulamadan bir ürün adı yazdığında veya ürünün fotoğrafını çektiğinde; motorumuz kimyasal bileşenleri otomatik ayrıştırıyor, '
    '1.390 yasaklı ve yüzlerce kısıtlı kimyasalla kıyaslayarak ürünün temiz olup olmadığını, alerjen içerip içermediğini ve her bir bileşenin '
    'Türkçe görevini saniyeler içinde sunuyor."',
    quote_style
))

story.append(Paragraph('🎙️ "En Çok Hangi Teknik Zorluğu Çözdünüz?" Sorusuna Yanıt:', h2_style))
story.append(Paragraph(
    '"İki büyük mühendislik zorluğu çözdük: '
    '<br/>1) <b>Kimyasal Virgül Çakışması:</b> <i>1,2-hexanediol</i> gibi adlardaki kimyasal virgülleri parantez derinliği ve rakam komşuluğu kontrolüyle koruyan akıllı bir ayrıştırıcı yazdık. '
    '<br/>2) <b>Hukuki İstisnalar (False-Positives):</b> AB yönetmeliğinde ham petrol distilatları veya saf furokumarin yasaktır ancak saflaştırılmış kozmetik vazelin ve doğal turunçgil yağları muaftır. '
    'Kural tabanlı filtrelerimizle bu istisnaları işleyerek vazelinin veya portakal yağının yanlışlıkla yasaklı çıkmasını engelledik."',
    quote_style
))

# Dokümanı Derle
doc.build(story)
print(f'PDF basariyla uretildi: {PDF_PATH}')
