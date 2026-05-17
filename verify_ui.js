const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + process.cwd() + '/index.html');
  await page.setViewportSize({ width: 1280, height: 1000 });

  // Wait for rendering
  await page.waitForSelector('.swatch', { timeout: 5000 });

  // Screenshot main view
  await page.screenshot({ path: 'ui_main_v9.png' });

  // Switch to Glass view
  await page.click('label[for="view-glass"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'ui_glass_v9.png' });

  // Switch to Gradients view
  await page.click('label[for="view-gradients"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'ui_gradients_v9.png' });

  // Switch back to Palettes and test yellow shift
  await page.click('label[for="view-palettes"]');
  await page.fill('#textColor', '#ffff00');
  await page.click('body'); // blur
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'ui_yellow_standard.png' });

  // Enable Light Mode Boost
  await page.click('label[for="light-mode-boost-toggle"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'ui_yellow_boosted.png' });

  await browser.close();
})();
