// Helpers para usar Puppeteer e Playwright para automação e renderização
const puppeteer = require('puppeteer-core');
const { chromium } = require('playwright');

async function screenshotWithPuppeteer(url, outPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
}

async function screenshotWithPlaywright(url, outPath) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
}

async function getHtmlWithPlaywright(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const html = await page.content();
  await browser.close();
  return html;
}

module.exports = {
  screenshotWithPuppeteer,
  screenshotWithPlaywright,
  getHtmlWithPlaywright
};
