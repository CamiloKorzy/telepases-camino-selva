import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

# Directories
VIDEOS_DIR = os.path.abspath('public/videos')
DOCS_VIDEOS_DIR = os.path.abspath('Documentos/Videos')
TEMP_DIR = os.path.abspath('scratch/temp_videos')

os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs(DOCS_VIDEOS_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# 1920x1080 resolution for recording
VIEWPORT = {'width': 1920, 'height': 1080}

def record_video_single_tag():
    print("\n--- Recording Video 1: Single TAG Registration (1080p Centered) ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport=VIEWPORT,
            record_video_dir=TEMP_DIR,
            record_video_size=VIEWPORT
        )
        page = context.new_page()
        
        # 1. Navigate & Login
        page.goto('http://localhost:3000')
        page.wait_for_timeout(1500)
        
        page.fill('input[placeholder*="camilo"]', 'peaje.victoria@caminoselva.com')
        page.wait_for_timeout(800)
        page.fill('input[type="password"]', 'Victoria$$2026')
        page.wait_for_timeout(800)
        page.click('button[type="submit"]')
        page.wait_for_timeout(2500)
        
        # 2. Scroll smooth to focus on the Delivery Form
        page.evaluate('''() => {
            const el = document.getElementById("formulario-entrega-section");
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                window.scrollTo({ top: 220, behavior: "smooth" });
            }
        }''')
        page.wait_for_timeout(1800)
        
        # 3. Click 'Primer Disp.' to auto-populate TAG
        primer_disp = page.locator('button:has-text("Primer Disp.")')
        primer_disp.click()
        page.wait_for_timeout(1200)
        
        # 4. Fill Dominio, DNI, and Name for 1 TAG
        dom_input = page.locator('input[placeholder*="AA123CD"]').nth(0)
        dom_input.click()
        dom_input.fill('AF987XY')
        page.wait_for_timeout(1000)
        
        dni_input = page.locator('input[placeholder*="30712345678"]').nth(0)
        dni_input.click()
        dni_input.fill('20345678901')
        page.wait_for_timeout(1000)
        
        nom_input = page.locator('input[placeholder*="Juan Pérez"]').nth(0)
        nom_input.click()
        nom_input.fill('Juan Carlos Gómez')
        page.wait_for_timeout(1500)
        
        # 5. Click Register Delivery button
        submit_btn = page.locator('button:has-text("REGISTRAR ENTREGA DE 1 TAG")')
        submit_btn.scroll_into_view_if_needed()
        page.wait_for_timeout(1200)
        submit_btn.click()
        page.wait_for_timeout(3500)
        
        # 6. Scroll down to show delivery added in the Grid
        page.evaluate('window.scrollBy({top: 450, behavior: "smooth"})')
        page.wait_for_timeout(3500)
        
        video_file_path = page.video.path()
        context.close()
        browser.close()
        
        target_mp4 = os.path.join(VIDEOS_DIR, 'registro_1_tag.mp4')
        cmd = f'ffmpeg -y -i "{video_file_path}" -c:v libx264 -preset fast -pix_fmt yuv420p "{target_mp4}"'
        subprocess.run(cmd, shell=True, check=True)
        
        # Copy to Documentos/Videos
        doc_mp4 = os.path.join(DOCS_VIDEOS_DIR, 'registro_1_tag.mp4')
        subprocess.run(f'copy /Y "{target_mp4}" "{doc_mp4}"', shell=True, check=True)
        print(f"Video 1 successfully recorded and exported to: {target_mp4}")

def record_video_batch_tags():
    print("\n--- Recording Video 2: Batch TAGs Registration (1080p Centered) ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport=VIEWPORT,
            record_video_dir=TEMP_DIR,
            record_video_size=VIEWPORT
        )
        page = context.new_page()
        
        # 1. Navigate & Login
        page.goto('http://localhost:3000')
        page.wait_for_timeout(1500)
        
        page.fill('input[placeholder*="camilo"]', 'peaje.victoria@caminoselva.com')
        page.wait_for_timeout(800)
        page.fill('input[type="password"]', 'Victoria$$2026')
        page.wait_for_timeout(800)
        page.click('button[type="submit"]')
        page.wait_for_timeout(2500)
        
        # 2. Scroll smooth to focus on the Delivery Form
        page.evaluate('''() => {
            const el = document.getElementById("formulario-entrega-section");
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                window.scrollTo({ top: 220, behavior: "smooth" });
            }
        }''')
        page.wait_for_timeout(1800)
        
        # 3. Click 'Primer Disp.'
        page.locator('button:has-text("Primer Disp.")').click()
        page.wait_for_timeout(1000)
        
        # 4. Set Quantity to 3
        qty_input = page.locator('input[type="number"]')
        qty_input.click()
        qty_input.fill('3')
        page.wait_for_timeout(1500)
        
        # 5. Fill Row 1
        dom1 = page.locator('input[placeholder*="AA123CD"]').nth(0)
        dom1.click()
        dom1.fill('AC123DE')
        page.wait_for_timeout(800)
        
        dni1 = page.locator('input[placeholder*="30712345678"]').nth(0)
        dni1.click()
        dni1.fill('30718889994')
        page.wait_for_timeout(800)
        
        nom1 = page.locator('input[placeholder*="Juan Pérez"]').nth(0)
        nom1.click()
        nom1.fill('Empresa Logística Selva S.A.')
        page.wait_for_timeout(1200)
        
        # 6. Click 'Replicar DNI y Nombre'
        replicate_btn = page.locator('button:has-text("Replicar DNI y Nombre")')
        replicate_btn.click()
        page.wait_for_timeout(1500)
        
        # 7. Fill Dominios for Row 2 & Row 3
        dom2 = page.locator('input[placeholder*="AA123CD"]').nth(1)
        dom2.click()
        dom2.fill('AD456FG')
        page.wait_for_timeout(800)
        
        dom3 = page.locator('input[placeholder*="AA123CD"]').nth(2)
        dom3.click()
        dom3.fill('AE789HI')
        page.wait_for_timeout(1200)
        
        # 8. Submit Batch Delivery
        submit_btn = page.locator('button:has-text("REGISTRAR ENTREGA MASIVA DE 3 TAGS")')
        submit_btn.scroll_into_view_if_needed()
        page.wait_for_timeout(1200)
        submit_btn.click()
        page.wait_for_timeout(4000)
        
        # 9. Scroll down to show Grid results
        page.evaluate('window.scrollBy({top: 450, behavior: "smooth"})')
        page.wait_for_timeout(3500)
        
        video_file_path = page.video.path()
        context.close()
        browser.close()
        
        target_mp4 = os.path.join(VIDEOS_DIR, 'registro_masivo_tags.mp4')
        cmd = f'ffmpeg -y -i "{video_file_path}" -c:v libx264 -preset fast -pix_fmt yuv420p "{target_mp4}"'
        subprocess.run(cmd, shell=True, check=True)
        
        doc_mp4 = os.path.join(DOCS_VIDEOS_DIR, 'registro_masivo_tags.mp4')
        subprocess.run(f'copy /Y "{target_mp4}" "{doc_mp4}"', shell=True, check=True)
        print(f"Video 2 successfully recorded and exported to: {target_mp4}")

if __name__ == '__main__':
    record_video_single_tag()
    record_video_batch_tags()
