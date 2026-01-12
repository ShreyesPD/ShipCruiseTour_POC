/**
 * Video Helper Utility
 * Ensures proper video encoding and saving in Playwright tests
 * Prevents video corruption by allowing encoder to flush properly
 */

/**
 * Ensures video is properly saved before test teardown
 * Call this in afterEach hooks for tests with video recording enabled
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').BrowserContext} context - Browser context
 */
async function ensureVideoSaved(page, context) {
  // Allow video encoder to flush buffered frames
  await page.waitForTimeout(1000);
  
  // Close context gracefully
  await context.close();
  
  // Final buffer time to ensure video file is written to disk
  await page.waitForTimeout(500);
}

/**
 * Ensures videos are saved for all pages in a context
 * Useful for tests with multiple tabs/pages
 * 
 * @param {import('@playwright/test').BrowserContext} context - Browser context
 */
async function ensureAllVideosSaved(context) {
  const pages = context.pages();
  
  // Wait for all pages to finish rendering
  for (const page of pages) {
    try {
      await page.waitForTimeout(500);
    } catch (error) {
      // Page might already be closed, ignore
    }
  }
  
  // Allow encoder to flush
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Close context
  await context.close();
  
  // Final buffer
  await new Promise(resolve => setTimeout(resolve, 500));
}

module.exports = {
  ensureVideoSaved,
  ensureAllVideosSaved
};
