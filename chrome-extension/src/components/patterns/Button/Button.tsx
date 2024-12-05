import React, { ReactElement } from "react";
import styles from "./Button.module.css";
import classNames from "classnames";

export interface ButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  label?: string;
  icon?: ReactElement;
  variant?: "primary" | "secondary" | "ghost";
  size?: "rg" | "sm";
  disabled?: boolean;
}

const Button = ({
  label,
  icon,
  variant = "secondary",
  size = "rg",
  className,
  disabled,
  onClick,
  ...rest
}: ButtonProps) => {
  return (
    <button
      className={classNames(
        className,
        styles.base,
        styles[variant],
        styles[size],
        label ? styles.hasLabel : null,
        disabled ? styles.disabled : null
      )}
      aria-disabled={disabled}
      onClick={!disabled ? onClick : undefined}
      {...rest}
    >
      {icon && <div className={styles.icon}>{icon}</div>} {label && label}
    </button>
  );
};

export default Button;
