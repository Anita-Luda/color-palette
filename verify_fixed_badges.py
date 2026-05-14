
import sys
import time
from playwright.sync_api import sync_playwright

def verify_fixed_badges():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            page.goto("http://localhost:3000", timeout=5000)
        except:
            print("Server not running? Please ensure server is running on port 3000.")
            browser.close()
            return

        print("Testing Fixed Scale Badges...")

        # 1. Switch to 'Fixed' scale by clicking its label
        page.click("label[for='scale-fixed']")
        time.sleep(0.5)

        # 2. Set granularity to 100
        page.click(".gran-btn[data-val='100']")
        time.sleep(0.5)

        # Check if 100 badges are visible
        # Note: they might be in any palette section
        badges_100 = page.query_selector_all(".swatch-badge.step100.visible")
        print(f"Found {len(badges_100)} '100' badges in Fixed mode (granularity 100).")

        # Check if BASE badge is visible
        base_badge = page.query_selector(".swatch-badge.base.visible")
        print(f"Base badge visible: {base_badge is not None}")

        page.screenshot(path="verify_fixed_badges_100.png")

        # 3. Set granularity to 10
        page.click(".gran-btn[data-val='10']")
        time.sleep(0.5)

        badges_50 = page.query_selector_all(".swatch-badge.step50.visible")
        print(f"Found {len(badges_50)} '50' badges in Fixed mode (granularity 10).")

        page.screenshot(path="verify_fixed_badges_10.png")

        browser.close()

if __name__ == "__main__":
    verify_fixed_badges()
