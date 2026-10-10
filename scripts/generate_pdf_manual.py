import os
import markdown
from playwright.sync_api import sync_playwright

def generate_pdf():
    md_path = r"C:\Datos\Proyectos IT\Telepases\Documentos\GUIA_DE_OPERACION.md"
    pdf_dest_1 = r"C:\Datos\Proyectos IT\Telepases\Documentos\Manual_de_Operacion_TelePASE_Camino_Selva.pdf"
    pdf_dest_2 = r"C:\Datos\Proyectos IT\Telepases\Manual_de_Operacion_TelePASE_Camino_Selva.pdf"
    logo_path = r"C:\Datos\Proyectos IT\Telepases\public\logo.png"

    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    # HTML template with Camino Selva styling
    html_content = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Manual Oficial de Operación - TelePASE Camino Selva</title>
      <style>
        @page {{
          size: A4;
          margin: 20mm 15mm 20mm 15mm;
          @bottom-right {{
            content: counter(page);
          }}
        }}
        body {{
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #1e293b;
          line-height: 1.6;
          font-size: 13px;
          padding: 0;
          margin: 0;
        }}
        .header-box {{
          background-color: #054a29;
          color: white;
          padding: 24px 30px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }}
        .header-title h1 {{
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
        }}
        .header-title h2 {{
          margin: 4px 0 0 0;
          font-size: 14px;
          font-weight: 600;
          color: #6ee7b7;
        }}
        .header-logo img {{
          max-height: 50px;
          background: white;
          padding: 6px;
          border-radius: 8px;
        }}
        h1 {{
          color: #054a29;
          font-size: 18px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 6px;
          margin-top: 24px;
        }}
        h2 {{
          color: #043920;
          font-size: 15px;
          margin-top: 20px;
        }}
        h3 {{
          color: #0f766e;
          font-size: 13px;
          margin-top: 14px;
        }}
        p, li {{
          color: #334155;
        }}
        table {{
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 12px;
        }}
        th {{
          background-color: #0b291a;
          color: white;
          text-align: left;
          padding: 8px 12px;
          font-weight: 700;
        }}
        td {{
          padding: 8px 12px;
          border-bottom: 1px solid #e2e8f0;
        }}
        tr:nth-child(even) {{
          background-color: #f8fafc;
        }}
        code {{
          background-color: #f1f5f9;
          color: #0f766e;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Consolas', monospace;
          font-weight: bold;
        }}
        pre {{
          background-color: #0f172a;
          color: #38bdf8;
          padding: 14px;
          border-radius: 8px;
          font-family: 'Consolas', monospace;
          font-size: 11px;
          white-space: pre-wrap;
        }}
        hr {{
          border: none;
          border-top: 1px solid #cbd5e1;
          margin: 24px 0;
        }}
        .badge {{
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 11px;
        }}
        .badge-admin {{ background-color: #dcfce7; color: #166534; }}
        .badge-op {{ background-color: #e0f2fe; color: #075985; }}
        .badge-query {{ background-color: #fef3c7; color: #92400e; }}
        .footer {{
          margin-top: 40px;
          padding-top: 12px;
          border-top: 1px solid #cbd5e1;
          font-size: 10px;
          color: #64748b;
          text-align: center;
        }}
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="header-title">
          <h1>MANUAL OFICIAL DE OPERACIÓN</h1>
          <h2>Plataforma TelePASE - Corredor Vial Noreste (Camino Selva S.A.)</h2>
        </div>
      </div>

      <div>
        {markdown.markdown(md_text, extensions=['tables', 'fenced_code'])}
      </div>

      <div class="footer">
        Documentación Oficial del Área de IT - CEE ENRIQUEZ / Camino Selva S.A. | Generado para Distribución Corporativa
      </div>
    </body>
    </html>
    """

    temp_html = r"C:\Datos\Proyectos IT\Telepases\scratch\manual_temp.html"
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_content)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f"file:///{temp_html.replace('\\', '/')}")
        page.pdf(
            path=pdf_dest_1,
            format="A4",
            print_background=True,
            margin={"top": "15mm", "bottom": "15mm", "left": "15mm", "right": "15mm"}
        )
        page.pdf(
            path=pdf_dest_2,
            format="A4",
            print_background=True,
            margin={"top": "15mm", "bottom": "15mm", "left": "15mm", "right": "15mm"}
        )
        browser.close()

    print(f"PDF generado exitosamente en:\n1. {pdf_dest_1}\n2. {pdf_dest_2}")

if __name__ == "__main__":
    generate_pdf()
