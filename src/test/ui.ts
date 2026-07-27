import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export function setupUser() {
  // Radix overlays toggle pointer-events on <body>; disable the check for stable tests
  return userEvent.setup({ pointerEventsCheck: 0 });
}

export type User = ReturnType<typeof setupUser>;

// Open a shadcn/Radix Select via its trigger, then pick an option (options render in a portal)
export async function pickOption(user: User, trigger: HTMLElement, optionName: string | RegExp) {
  await user.click(trigger);
  await user.click(await screen.findByRole('option', { name: optionName }));
}
