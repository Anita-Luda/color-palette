
import sys
import time
from playwright.sync_api import sync_playwright

def check_for_errors():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        errors = []
        page.on("pageerror", lambda exc: errors.append(f"JS Error: {exc}"))
        page.on("console", lambda msg: print(f"Console {msg.type}: {msg.text}"))
        page.on("requestfailed", lambda req: errors.append(f"Request Failed: {req.url} - {req.failure}"))

        try:
            page.goto("http://localhost:3000", timeout=5000)
            time.sleep(3) # wait for modules to load
        except Exception as e:
            print(f"Navigation Error: {e}")

        if errors:
            print("\nDetected Page Errors:")
            for err in errors:
                print(err)

        count = len(page.query_selector_all(".swatch"))
        print(f"\nSwatches rendered: {count}")

        browser.close()

if __name__ == "__main__":
    check_for_errors()
