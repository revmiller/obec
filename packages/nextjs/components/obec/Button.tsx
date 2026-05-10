"use client";

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "ghost";
type Size = "sm" | "md" | "lg";

const buildClass = (variant: Variant, size: Size, extra?: string) => {
  const cls = ["obec-btn"];
  if (variant === "ghost") cls.push("ghost");
  if (size === "sm") cls.push("sm");
  if (size === "lg") cls.push("lg");
  if (extra) cls.push(extra);
  return cls.join(" ");
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", size = "md", arrow, children, className, ...rest }: ButtonProps) {
  return (
    <button {...rest} className={buildClass(variant, size, className)}>
      {children}
      {arrow && <span className="arrow">→</span>}
    </button>
  );
}

type LinkButtonProps = CommonProps & {
  href: string;
  external?: boolean;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export function LinkButton({
  variant = "primary",
  size = "md",
  arrow,
  children,
  className,
  href,
  external,
  ...rest
}: LinkButtonProps) {
  const cls = buildClass(variant, size, className);
  if (external) {
    return (
      <a {...rest} href={href} target="_blank" rel="noreferrer" className={cls}>
        {children}
        {arrow && <span className="arrow">→</span>}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
      {arrow && <span className="arrow">→</span>}
    </Link>
  );
}
