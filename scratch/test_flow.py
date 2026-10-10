import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

def inspect_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:3000')
        
        # Login
        page.fill('input[placeholder*="camilo"]', 'peaje.victoria@caminoselva.com')
        page.fill('input[type="password"]', 'Victoria$$2026')
        page.click('button[type="submit"]')
        page.wait_for_timeout(2000)
        
        print("Logged in!")
        buttons = page.query_selector_all('button')
        print(f"\nDashboard buttons ({len(buttons)}):")
        for b in buttons:
            txt = b.inner_text().strip().replace('\n', ' ')
            print(f" - [{txt}]")
            
        inputs = page.query_selector_all('input, select, textarea')
        print(f"\nDashboard inputs ({len(inputs)}):")
        for inp in inputs:
            p_holder = inp.get_attribute('placeholder') or ''
            name = inp.get_attribute('name') or ''
            tp = inp.get_attribute('type') or ''
            val = inp.get_attribute('value') or ''
            print(f" - Tag: {inp.tag_name}, type: {tp}, placeholder: '{p_holder}', name: '{name}', val: '{val}'")
            
        browser.close()

if __name__ == '__main__':
    inspect_dashboard()
