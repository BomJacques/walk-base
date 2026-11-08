// Shared by the browser tests. Some commands now live in drop-down menus, so a test asks for a command by its test id
// and this opens the right menu first when the command is not already on screen.

/** Click (or tap) a control by test id, opening its menu first if it lives in one. */
export async function press(page, id, { tap = false } = {}) {
  const act = (loc) => (tap ? loc.tap() : loc.click());
  const here = page.locator(`[data-testid="${id}"]:visible`).first();
  if (await here.count()) return act(here);
  const owner = await page.evaluate((i) => window.__walkBase.menuOwner(i), id);
  if (!owner) throw new Error(`No control with test id ${id}, on screen or in a menu`);
  await act(page.locator(`[data-testid="${owner}"]:visible`).first());
  const item = page.locator(`[data-testid="${id}"]:visible`).first();
  await item.waitFor({ state: 'visible', timeout: 5000 });
  return act(item);
}
