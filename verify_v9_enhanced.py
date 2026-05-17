import asyncio
import os
import time
import subprocess
from playwright.async_api import async_playwright

async def run_verification():
    server_process = subprocess.Popen(["python3", "-m", "http.server", "8000"])
    time.sleep(2)

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={'width': 1280, 'height': 1600})
            await page.goto("http://localhost:8000/index.html")
            await page.wait_for_selector("#output")

            print("Configuring state via JS...")
            await page.evaluate("""
                (async () => {
                    const core = await import('./engine/engine.core.js');
                    core.addColor();
                    core.addColor();
                    core.setGlassBubbleSource(0);
                    core.toggleColorInGradient(0, true);
                    core.toggleColorInGradient(1, true);
                    window.refreshUI();
                })()
            """)
            await asyncio.sleep(2.0)

            # 1. Gradient View
            print("Taking Gradient View screenshot...")
            await page.click("label[for='view-gradients']")
            await asyncio.sleep(2.0)
            path_grad = "verification_logs/v9_three_color_gradient.png"
            await page.screenshot(path=path_grad, full_page=True)

            # 2. Glass View
            print("Taking Glass View screenshot...")
            await page.click("label[for='view-glass']")
            await asyncio.sleep(2.0)
            path_glass = "verification_logs/v9_custom_bubble_glass.png"
            await page.screenshot(path=path_glass, full_page=True)

            await browser.close()
    finally:
        server_process.terminate()

if __name__ == "__main__":
    if not os.path.exists("verification_logs"):
        os.makedirs("verification_logs")
    asyncio.run(run_verification())
