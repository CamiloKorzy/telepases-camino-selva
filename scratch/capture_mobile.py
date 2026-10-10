import os
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

def capture_mobile():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # Mobile context (Pixel 5 size: 393x851)
        context_mobile = browser.new_context(viewport={'width': 393, 'height': 851})
        page = context_mobile.new_page()
        page.goto('http://localhost:3000')
        
        # Login
        page.fill('input[placeholder*="camilo"]', 'peaje.victoria@caminoselva.com')
        page.fill('input[type="password"]', 'Victoria$$2026')
        page.click('button[type="submit"]')
        page.wait_for_timeout(2000)
        
        # Screenshot top mobile view (Delivery Form is FIRST at the top!)
        page.screenshot(path='scratch/mobile_top_form.png')
        print("Mobile top screenshot saved: scratch/mobile_top_form.png")
        
        # Click 'Primer Disp.' and scroll down slightly to view stacked cards
        page.click('button:has-text("Primer Disp.")')
        page.wait_for_timeout(500)
        page.evaluate('window.scrollBy({top: 200, behavior: "instant"})')
        page.screenshot(path='scratch/mobile_form_cards.png')
        print("Mobile cards screenshot saved: scratch/mobile_form_cards.png")
        
        context_mobile.close()
        browser.close()

if __name__ == '__main__':
    capture_mobile()
