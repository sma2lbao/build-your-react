export type HookFlags = number;

export const NoFlags = 0b0000;

export const HasEffect = 0b0001;

export const Insertion = 0b0010;

export const Layout = 0b0100;

export const Passive = 0b1000;
