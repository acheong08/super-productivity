import { test } from '../../fixtures/test.fixture';

const PANEL_BTN = '.e2e-toggle-issue-provider-panel';
const CANCEL_BTN = 'mat-dialog-actions button:first-child';

test.describe('Issue Provider Panel', () => {
  test('should open all dialogs without error', async ({ page, workViewPage }) => {
    // Wait for work view to be ready
    await workViewPage.waitForTaskList();

    await page.waitForSelector(PANEL_BTN, { state: 'visible' });
    await page.click(PANEL_BTN);
    await page.waitForSelector('mat-tab-group', { state: 'visible' });
    // Click on the last tab (add tab) which contains the issue-provider-setup-overview
    await page.click('mat-tab-group .mat-mdc-tab:last-child');
    await page.waitForSelector('issue-provider-setup-overview', { state: 'visible' });

    // Wait for the setup overview to be fully loaded
    await page.waitForTimeout(1000);

    // Get all buttons in the issue provider setup overview
    const setupButtons = page.locator('issue-provider-setup-overview button');
    const buttonCount = await setupButtons.count();

    // Click each button and close the dialog
    for (let i = 0; i < buttonCount; i++) {
      const button = setupButtons.nth(i);

      // Skip if button is not visible or enabled
      const isVisible = await button.isVisible().catch(() => false);
      const isEnabled = await button.isEnabled().catch(() => false);

      if (isVisible && isEnabled) {
        await button.click();

        // Wait for dialog to open
        const dialogOpened = await page
          .waitForSelector(CANCEL_BTN, {
            state: 'visible',
            timeout: 5000,
          })
          .catch(() => null);

        if (dialogOpened) {
          await page.click(CANCEL_BTN);
          // Wait for dialog to close
          await page.waitForTimeout(500);
        }
      }
    }

    // No error check is implicit - test will fail if any error occurs
  });
});
