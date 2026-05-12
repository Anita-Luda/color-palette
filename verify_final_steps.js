const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);

  // Check functional palette steps
  const functionalSwatches = await page.evaluate(() => {
    const section = Array.from(document.querySelectorAll('section.palette')).find(s => s.innerText.includes('Paleta funkcjonalna'));
    return Array.from(section.querySelectorAll('.swatch-step')).map(el => el.innerText);
  });
  console.log('Functional steps:', functionalSwatches);

  // Check badge palette steps
  const badgeSwatches = await page.evaluate(() => {
    const section = Array.from(document.querySelectorAll('section.palette')).find(s => s.innerText.includes('Paleta badge'));
    return Array.from(section.querySelectorAll('.swatch-step')).map(el => el.innerText);
  });
  console.log('Badge steps:', badgeSwatches);

  await page.screenshot({ path: 'final_verification_steps.png', fullPage: true });
  await browser.close();
})();
