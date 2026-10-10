import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

# Ensure output videos directory exists
VIDEOS_DIR = os.path.abspath('public/videos')
os.makedirs(VIDEOS_DIR, exist_ok=True)
TEMP_DIR = os.path.abspath('scratch/temp_videos')
os.makedirs(TEMP_DIR, exist_ok=True)

def record_video_single_tag():
    print("\n--- Recording Video 1: Single TAG Registration ---")
    with sync_playwright() as p:
        # Launch browser with video recording in temp directory
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            record_video_dir=TEMP_DIR,
            record_video_size={'width': 1280, 'height': 720}
        )
        page = context.new_page()
        
        # 1. Navigate to portal
        page.goto('http://localhost:3000')
        page.wait_for_timeout(1500)
        
        # 2. Login
        page.fill('input[placeholder*="camilo"]', 'peaje.victoria@caminoselva.com')
        page.wait_for_timeout(800)
        page.fill('input[type="password"]', 'Victoria$$2026')
        page.wait_for_timeout(800)
        page.click('button[type="submit"]')
        page.wait_for_timeout(2500)
        
        # 3. Highlight form area & click 'Primer Disp.' to ensure valid TAG
        page.wait_for_timeout(1000)
        page.click('button:has-text("Primer Disp.")')
        page.wait_for_timeout(1200)
        
        # 4. Fill Dominio, DNI, and Name for single TAG
        page.fill('input[placeholder*="AA123CD"]', 'AF987XY')
        page.wait_for_timeout(1000)
        
        page.fill('input[placeholder*="30712345678"]', '20345678901')
        page.wait_for_timeout(1000)
        
        page.fill('input[placeholder*="Juan Pérez"]', 'Juan Carlos Gómez')
        page.wait_for_timeout(1500)
        
        # 5. Submit delivery
        submit_btn = page.locator('button:has-text("REGISTRAR ENTREGA DE 1 TAG")')
        submit_btn.scroll_into_view_if_needed()
        page.wait_for_timeout(1000)
        submit_btn.click()
        page.wait_for_timeout(3500)
        
        # 6. Scroll down to show delivery added in Grid
        page.evaluate('window.scrollTo({top: 400, behavior: "smooth"})')
        page.wait_for_timeout(3000)
        
        # Close context to finalize video writing
        video_file_path = page.video.path()
        context.close()
        browser.close()
        
        # Convert webm to mp4 via ffmpeg
        target_mp4 = os.path.join(VIDEOS_DIR, 'registro_1_tag.mp4')
        cmd = f'ffmpeg -y -i "{video_file_path}" -c:v libx264 -preset fast -pix_fmt yuv420p "{target_mp4}"'
        subprocess.run(cmd, shell=True, check=True)
        print(f"Video 1 created successfully at: {target_mp4}")

def record_video_batch_tags():
    print("\n--- Recording Video 2: Batch (Multiple) TAGs Registration ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            record_video_dir=TEMP_DIR,
            record_video_size={'width': 1280, 'height': 720}
        )
        page = context.new_page()
        
        # 1. Navigate to portal
        page.goto('http://localhost:3000')
        page.wait_for_timeout(1500)
        
        # 2. Login
        page.fill('input[placeholder*="camilo"]', 'peaje.victoria@caminoselva.com')
        page.wait_for_timeout(800)
        page.fill('input[type="password"]', 'Victoria$$2026')
        page.wait_for_timeout(800)
        page.click('button[type="submit"]')
        page.wait_for_timeout(2500)
        
        # 3. Click 'Primer Disp.' to ensure starting valid TAG
        page.click('button:has-text("Primer Disp.")')
        page.wait_for_timeout(1000)
        
        # 4. Change Quantity to 3 TAGs
        qty_input = page.locator('input[type="number"]')
        qty_input.fill('3')
        page.wait_for_timeout(1500)
        
        # 5. Fill Row 1 data (Dominio, DNI, Enterprise Name)
        dominios = ['AC123DE', 'AD456FG', 'AE789HI']
        
        # Fill Row 1 Dominio
        row1_dom = page.locator('input[placeholder*="AA123CD"]').nth(0)
        row1_dom.fill(dominios[0])
        page.wait_for_timeout(800)
        
        # Fill Row 1 DNI / CUIT
        row1_dni = page.locator('input[placeholder*="30712345678"]').nth(0)
        row1_dni.fill('30718889994')
        page.wait_for_timeout(800)
        
        # Fill Row 1 Nombre
        row1_nombre = page.locator('input[placeholder*="Juan Pérez"]').nth(0)
        row1_nombre.fill('Empresa Logística Selva S.A.')
        page.wait_for_timeout(1200)
        
        # 6. Click 'Replicar DNI y Nombre' button to populate remaining rows automatically
        replicate_btn = page.locator('button:has-text("Replicar DNI y Nombre")')
        replicate_btn.click()
        page.wait_for_timeout(1500)
        
        # 7. Fill Dominios for Row 2 and Row 3
        row2_dom = page.locator('input[placeholder*="AA123CD"]').nth(1)
        row2_dom.fill(dominios[1])
        page.wait_for_timeout(800)
        
        row3_dom = page.locator('input[placeholder*="AA123CD"]').nth(2)
        row3_dom.fill(dominios[2])
        page.wait_for_timeout(1200)
        
        # 8. Submit batch delivery
        submit_btn = page.locator('button:has-text("REGISTRAR ENTREGA MASIVA DE 3 TAGS")')
        submit_btn.scroll_into_view_if_needed()
        page.wait_for_timeout(1200)
        submit_btn.click()
        page.wait_for_timeout(4000)
        
        # 9. Scroll down to show batch deliveries in Grid
        page.evaluate('window.scrollTo({top: 450, behavior: "smooth"})')
        page.wait_for_timeout(3500)
        
        video_file_path = page.video.path()
        context.close()
        browser.close()
        
        target_mp4 = os.path.join(VIDEOS_DIR, 'registro_masivo_tags.mp4')
        cmd = f'ffmpeg -y -i "{video_file_path}" -c:v libx264 -preset fast -pix_fmt yuv420p "{target_mp4}"'
        subprocess.run(cmd, shell=True, check=True)
        print(f"Video 2 created successfully at: {target_mp4}")

if __name__ == '__main__':
    record_video_single_tag()
    record_video_batch_tags()
