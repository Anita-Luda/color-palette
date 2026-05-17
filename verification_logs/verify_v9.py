from playwright.sync_api import sync_playwright
import datetime
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Access via local server to avoid CORS
        page.goto("http://localhost:8000/index.html")
        page.set_viewport_size({"width": 1280, "height": 1200})

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

        # 1. Main View with Yellow #ffff00
        page.fill("#textColor", "#ffff00")
        page.keyboard.press("Enter")
        page.wait_for_timeout(2000)
        page.screenshot(path=f"verification_logs/{timestamp}_main_yellow.png")

        # 2. Glass View
        page.click("label[for='view-glass']")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"verification_logs/{timestamp}_glass_view.png")

        # 3. Gradients View
        page.click("label[for='view-gradients']")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"verification_logs/{timestamp}_gradients_view.png")

        # 4. Light Mode Boost Toggle
        page.click("label[for='view-palettes']")
        page.click("#light-mode-boost-toggle")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"verification_logs/{timestamp}_yellow_boost_on.png")

        browser.close()

if __name__ == "__main__":
    run()
