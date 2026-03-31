import type { Browser } from "puppeteer-core";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;

  const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isVercel) {
    // Serverless: use puppeteer-core + @sparticuz/chromium
    const chromium = await import("@sparticuz/chromium");
    const puppeteerCore = await import("puppeteer-core");
    browserInstance = await puppeteerCore.default.launch({
      args: chromium.default.args,
      defaultViewport: null,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  } else {
    // Local: use full puppeteer which bundles Chromium
    const puppeteer = await import("puppeteer");
    browserInstance = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    }) as unknown as Browser;
  }

  return browserInstance;
}

export async function screenshotHtml(options: {
  html: string;
  width: number;
  height: number;
}): Promise<{ buffer: Buffer; mimeType: "image/png" }> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: options.width,
      height: options.height,
      deviceScaleFactor: 1,
    });

    await page.setContent(options.html, { waitUntil: "networkidle0" });

    const screenshot = await page.screenshot({
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: options.width,
        height: options.height,
      },
    });

    return {
      buffer: Buffer.from(screenshot),
      mimeType: "image/png",
    };
  } finally {
    await page.close();
  }
}
