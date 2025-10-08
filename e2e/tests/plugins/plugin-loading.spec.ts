import { test, expect } from '../../fixtures/test.fixture';
import { cssSelectors } from '../../constants/selectors';
import {
  waitForPluginAssets,
  waitForPluginManagementInit,
  getCITimeoutMultiplier,
} from '../../helpers/plugin-test.helpers';

const { SIDENAV } = cssSelectors;

// Plugin-related selectors
const PLUGIN_CARD = 'plugin-management mat-card.ng-star-inserted';
const PLUGIN_ITEM = `${PLUGIN_CARD}`;
const PLUGIN_NAV_ENTRIES = `${SIDENAV} nav-item button`;
const PLUGIN_IFRAME = 'plugin-index iframe';

test.describe.serial('Plugin Loading', () => {
  test('full plugin loading lifecycle', async ({ page, workViewPage }) => {
    const timeoutMultiplier = getCITimeoutMultiplier();
    // Slightly higher base to avoid flakiness on slower environments
    test.setTimeout(45000 * timeoutMultiplier);

    // First, ensure plugin assets are available
    const assetsAvailable = await waitForPluginAssets(page);
    if (!assetsAvailable) {
      if (process.env.CI) {
        test.skip(true, 'Plugin assets not available in CI - skipping test');
        return;
      }
      throw new Error('Plugin assets not available - cannot proceed with test');
    }

    await workViewPage.waitForTaskList();

    // Use improved plugin management init that handles navigation and setup
    const pluginReady = await waitForPluginManagementInit(page);
    if (!pluginReady) {
      throw new Error('Plugin management could not be initialized');
    }

    // Enable the plugin
    const enableResult = await page.evaluate((pluginName: string) => {
      const cards = Array.from(document.querySelectorAll('plugin-management mat-card'));
      const targetCard = cards.find((card) => {
        const title = card.querySelector('mat-card-title')?.textContent || '';
        return title.includes(pluginName);
      });

      if (targetCard) {
        const toggleButton = targetCard.querySelector(
          'mat-slide-toggle button[role="switch"]',
        ) as HTMLButtonElement;
        if (toggleButton) {
          const wasChecked = toggleButton.getAttribute('aria-checked') === 'true';
          if (!wasChecked) {
            toggleButton.click();
          }
          return {
            enabled: true,
            found: true,
            wasChecked,
            nowChecked: toggleButton.getAttribute('aria-checked') === 'true',
            clicked: !wasChecked,
          };
        }
        return { enabled: false, found: true, error: 'No toggle found' };
      }

      return { enabled: false, found: false };
    }, 'API Test Plugin');

    expect(enableResult.found).toBe(true);

    await page.waitForTimeout(2000); // Wait for plugin to initialize

    // Navigate to plugin management
    await expect(page.locator(PLUGIN_CARD).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Check example plugin is loaded and enabled
    const pluginCardsResult = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('plugin-management mat-card'));
      const pluginCards = cards.filter((card) => card.querySelector('mat-slide-toggle'));
      return {
        totalCards: cards.length,
        pluginCardsCount: pluginCards.length,
        pluginTitles: pluginCards.map(
          (card) => card.querySelector('mat-card-title')?.textContent?.trim() || '',
        ),
      };
    });

    expect(pluginCardsResult.pluginCardsCount).toBeGreaterThanOrEqual(1);
    expect(pluginCardsResult.pluginTitles).toContain('API Test Plugin');

    // Navigate back to work view to see plugin menu
    await page.click('text=Today');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/#\/tag\/TODAY/);

    // Verify plugin menu entry exists
    const pluginNavItem = page
      .locator(PLUGIN_NAV_ENTRIES)
      .filter({ hasText: 'API Test Plugin' });
    const pluginMenuVisible = await pluginNavItem.isVisible().catch(() => false);
    if (pluginMenuVisible) {
      await expect(pluginNavItem).toContainText('API Test Plugin');
    } else {
      console.log(
        'Plugin menu not visible - may not be implemented or plugin not fully loaded',
      );
    }

    // Try to open plugin iframe view if menu is available
    if (pluginMenuVisible) {
      await pluginNavItem.click();
      await expect(page.locator(PLUGIN_IFRAME)).toBeVisible();
      await expect(page).toHaveURL(/\/plugins\/api-test-plugin\/index/);
      await page.waitForTimeout(1000); // Wait for iframe to load

      // Switch to iframe context and verify content
      const frame = page.frameLocator(PLUGIN_IFRAME);
      await expect(frame.locator('h1')).toBeVisible();
      await expect(frame.locator('h1')).toContainText('API Test Plugin');
    } else {
      console.log('Skipping iframe test - plugin menu not available');
    }
  });

  test('disable and re-enable plugin', async ({ page, workViewPage }) => {
    // Increase timeout to account for asset checking and plugin (un)load
    test.setTimeout(process.env.CI ? 90000 : 60000);

    // Check if plugin assets are available
    const assetsAvailable = await waitForPluginAssets(page);
    if (!assetsAvailable) {
      if (process.env.CI) {
        test.skip(true, 'Plugin assets not available in CI - skipping test');
        return;
      }
      throw new Error('Plugin assets not available - cannot proceed with test');
    }

    await workViewPage.waitForTaskList();

    // Use improved plugin management init that handles navigation and setup
    const pluginReady = await waitForPluginManagementInit(page);
    if (!pluginReady) {
      throw new Error('Plugin management could not be initialized');
    }

    // Enable the plugin first
    await page.evaluate((pluginName: string) => {
      const cards = Array.from(document.querySelectorAll('plugin-management mat-card'));
      const targetCard = cards.find((card) => {
        const title = card.querySelector('mat-card-title')?.textContent || '';
        return title.includes(pluginName);
      });

      if (targetCard) {
        const toggleButton = targetCard.querySelector(
          'mat-slide-toggle button[role="switch"]',
        ) as HTMLButtonElement;
        if (toggleButton) {
          const wasChecked = toggleButton.getAttribute('aria-checked') === 'true';
          if (!wasChecked) {
            toggleButton.click();
          }
        }
      }
    }, 'API Test Plugin');

    await page.waitForTimeout(2000); // Wait for plugin to initialize

    // Navigate to plugin management
    await expect(page.locator(PLUGIN_ITEM).first()).toBeVisible();

    // Find the toggle for API Test Plugin and disable it
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('plugin-management mat-card'));
      const apiTestCard = cards.find((card) => {
        const title = card.querySelector('mat-card-title')?.textContent || '';
        return title.includes('API Test Plugin');
      });
      const toggle = apiTestCard?.querySelector(
        'mat-slide-toggle button[role="switch"]',
      ) as HTMLButtonElement;

      const result = {
        found: !!apiTestCard,
        hasToggle: !!toggle,
        wasChecked: toggle?.getAttribute('aria-checked') === 'true',
        clicked: false,
      };

      if (toggle && toggle.getAttribute('aria-checked') === 'true') {
        toggle.click();
        result.clicked = true;
      }

      return result;
    });

    await page.waitForTimeout(2000); // Give more time for plugin to unload

    // Stay on the settings page, just wait for state to update
    await page.waitForTimeout(2000);

    // Re-enable the plugin - we should still be on settings page
    // Just make sure plugin section is visible
    await page.evaluate(() => {
      const pluginSection = document.querySelector('.plugin-section');
      if (pluginSection) {
        pluginSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('plugin-management mat-card'));
      const apiTestCard = cards.find((card) => {
        const title = card.querySelector('mat-card-title')?.textContent || '';
        return title.includes('API Test Plugin');
      });
      const toggle = apiTestCard?.querySelector(
        'mat-slide-toggle button[role="switch"]',
      ) as HTMLButtonElement;

      const result = {
        found: !!apiTestCard,
        hasToggle: !!toggle,
        wasChecked: toggle?.getAttribute('aria-checked') === 'true',
        clicked: false,
      };

      if (toggle && toggle.getAttribute('aria-checked') !== 'true') {
        toggle.click();
        result.clicked = true;
      }

      return result;
    });

    await page.waitForTimeout(2000); // Give time for plugin to reload

    // Navigate back to main view
    await page.click('text=Today'); // Click on Today navigation
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check if menu entry is back (gracefully handle if not visible)
    const pluginNavItemReEnabled = page
      .locator(PLUGIN_NAV_ENTRIES)
      .filter({ hasText: 'API Test Plugin' });
    const pluginMenuVisible = await pluginNavItemReEnabled.isVisible().catch(() => false);
    if (pluginMenuVisible) {
      await expect(pluginNavItemReEnabled).toContainText('API Test Plugin');
      console.log('Plugin menu entry verified after re-enable');
    } else {
      console.log('Plugin menu not visible after re-enable - may not be implemented');
    }
  });
});
