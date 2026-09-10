import os
import io
import subprocess
import shutil
import qrcode
import qrcode.image.svg

url = "https://ynr-cs.github.io/nanryosai2026/main/index.html"
download_dir = r"C:\Users\uokun\Downloads"
pdf_filename = "南陵祭2026_ウェブサイト_コンピュータ科学部.pdf"
pdf_path = os.path.join(download_dir, pdf_filename)
alt_pdf_path = os.path.join(download_dir, "南陵祭2026_ウェブサイト.pdf")

scratch_dir = r"C:\Users\uokun\.gemini\antigravity-ide\brain\85527649-b345-40d2-bcce-9293485d3cb8\scratch"
os.makedirs(scratch_dir, exist_ok=True)
html_path = os.path.join(scratch_dir, "poster.html")

# Generate high-precision SVG QR Code
factory = qrcode.image.svg.SvgPathImage
qr = qrcode.QRCode(
    version=None,
    error_correction=qrcode.constants.ERROR_CORRECT_M,
    box_size=10,
    border=1
)
qr.add_data(url)
qr.make(fit=True)
img = qr.make_image(image_factory=factory)
buf = io.BytesIO()
img.save(buf)
svg_content = buf.getvalue().decode("utf-8")

if "<?xml" in svg_content:
    svg_content = svg_content.split("?>", 1)[-1].strip()

html_content = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>南陵祭 2026 ウェブサイト</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 0;
  }}
  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}
  html, body {{
    width: 210mm;
    height: 297mm;
    margin: 0;
    padding: 10mm 12mm 12mm 12mm;
    background-color: #ffffff;
    color: #0f172a;
    font-family: "BIZ UDPGothic", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    overflow: hidden;
  }}

  /* Top Section */
  .header-container {{
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2mm;
    padding-top: 2mm;
  }}
  .title-main {{
    font-size: 64pt;
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: 0.04em;
    color: #090e17;
    white-space: nowrap;
  }}
  .title-sub {{
    font-size: 56pt;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: 0.12em;
    color: #1d4ed8;
    text-indent: 0.12em;
    white-space: nowrap;
  }}
  .divider-top {{
    width: 100%;
    height: 5px;
    background: #090e17;
    border-radius: 3px;
    margin-top: 3mm;
  }}

  /* Center Section (QR Code) */
  .qr-container {{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin: 1mm 0;
  }}
  .qr-frame {{
    background: #ffffff;
    padding: 4mm;
    border-radius: 24px;
    border: 5px solid #090e17;
    display: flex;
    align-items: center;
    justify-content: center;
  }}
  .qr-frame svg {{
    width: 116mm;
    height: 116mm;
    display: block;
  }}
  .scan-hint {{
    margin-top: 3.5mm;
    font-size: 18pt;
    font-weight: 900;
    color: #090e17;
    letter-spacing: 0.06em;
  }}
  .url-text {{
    margin-top: 1mm;
    font-size: 10.5pt;
    font-family: Consolas, monospace;
    font-weight: 700;
    color: #475569;
    letter-spacing: 0.01em;
  }}

  /* Bottom Section */
  .footer-container {{
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3mm;
    padding-bottom: 2mm;
  }}
  .divider-bottom {{
    width: 100%;
    height: 5px;
    background: #090e17;
    border-radius: 3px;
    margin-bottom: 2mm;
  }}
  .club-name {{
    font-size: 60pt;
    font-weight: 900;
    letter-spacing: 0.08em;
    color: #090e17;
    line-height: 1.0;
    text-indent: 0.08em;
    width: 100%;
    white-space: nowrap;
  }}
</style>
</head>
<body>
  <div class="header-container">
    <div class="title-main">南陵祭 2026</div>
    <div class="title-sub">ウェブサイト</div>
    <div class="divider-top"></div>
  </div>

  <div class="qr-container">
    <div class="qr-frame">
      {svg_content}
    </div>
    <div class="scan-hint">スマートフォンで読み取ってアクセス！</div>
    <div class="url-text">https://ynr-cs.github.io/nanryosai2026/main/index.html</div>
  </div>

  <div class="footer-container">
    <div class="divider-bottom"></div>
    <div class="club-name">コンピュータ科学部</div>
  </div>
</body>
</html>
"""

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"HTML generated at: {html_path}")

temp_pdf_path = os.path.join(scratch_dir, "temp_poster.pdf")
if os.path.exists(temp_pdf_path):
    os.remove(temp_pdf_path)

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
html_url = "file:///" + html_path.replace(os.sep, "/")
cmd = [
    edge_path,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={temp_pdf_path}",
    html_url
]

print("Converting to PDF using Microsoft Edge...")
subprocess.run(cmd, check=True)

if os.path.exists(temp_pdf_path):
    shutil.copy2(temp_pdf_path, pdf_path)
    shutil.copy2(temp_pdf_path, alt_pdf_path)
    size_kb = os.path.getsize(pdf_path) / 1024
    print(f"PDF successfully created at:")
    print(f"  {pdf_path} ({size_kb:.1f} KB)")
    print(f"  {alt_pdf_path} ({size_kb:.1f} KB)")
else:
    print("PDF generation failed!")



