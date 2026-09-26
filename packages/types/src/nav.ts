import { z } from 'zod';

export const NavLink = z.object({ label: z.string(), href: z.string() });
export type NavLink = z.infer<typeof NavLink>;

export const NavGroup = z.object({ title: z.string(), links: z.array(NavLink) });
export type NavGroup = z.infer<typeof NavGroup>;
