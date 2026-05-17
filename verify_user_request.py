import asyncio
import os
import time
import subprocess
from playwright.async_api import async_playwright

async def run_verification():
    # Start a local server to avoid CORS issues
    server_process = subprocess.Popen(["python3", "-m", "http.server", "8000"])
    time.sleep(2)  # Give the server time to start

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={'width': 1280, 'height': 1440})

            await page.goto("http://localhost:8000/index.html")
            await page.wait_for_selector("#output")

            # Helper to set base color
            async def set_base_color(hex_val):
                await page.fill("#textColor", hex_val)
                await page.press("#textColor", "Enter")
                await asyncio.sleep(0.5)

            # Helper to add one additional color
            async def add_additional_color():
                await page.click("#addColor")
                await asyncio.sleep(0.5)

            # Helper to set distribution
            async def set_distribution(mode):
                # mode: absolute, asymmetric, fixed
                # Inputs might be hidden, click labels instead
                if mode == 'absolute':
                    await page.click("label[for='scale-absolute']")
                elif mode == 'asymmetric':
                    await page.click("label[for='scale-asymmetric']")
                elif mode == 'fixed':
                    await page.click("label[for='scale-fixed']")
                await asyncio.sleep(0.5)

            # Helper to set granulation
            async def set_granulation(val):
                # val: 10, 50, 100
                await page.click(f"button.gran-btn[data-val='{val}']")
                await asyncio.sleep(0.5)

            # Ensure Light Mode Boost is ON to see the fix
            is_boost_checked = await page.is_checked("#light-mode-boost-toggle")
            if not is_boost_checked:
                await page.click("label[for='light-mode-boost-toggle']")
                await asyncio.sleep(0.5)

            # SETUP: Base color #ffff00 and 2 colors total
            await set_base_color("#ffff00")
            await add_additional_color()

            # CASE 1: Absolute, Gradation 10
            await set_distribution("absolute")
            await set_granulation("10")

            # Save screenshot
            path1 = "verification_logs/user_request_absolute_grad10.png"
            await page.screenshot(path=path1, full_page=True)
            print(f"Saved Case 1: {path1}")

            # CASE 2: Asymmetric, Gradation 100
            await set_distribution("asymmetric")
            await set_granulation("100")

            # Save screenshot
            path2 = "verification_logs/user_request_asymmetric_grad100.png"
            await page.screenshot(path=path2, full_page=True)
            print(f"Saved Case 2: {path2}")

            await browser.close()
    finally:
        server_process.terminate()

if __name__ == "__main__":
    if not os.path.exists("verification_logs"):
        os.makedirs("verification_logs")
    asyncio.run(run_verification())
