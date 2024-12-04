import React from "react";
import styles from "./Divider.module.css";
import classNames from "classnames";

interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  muted?: boolean;
}

const Divider = ({ className, muted = false, ...rest }: DividerProps) => {
  return (
    <div
      className={classNames(
        className,
        styles.divider,
        muted ? styles.muted : null
      )}
      {...rest}
    />
  );
};

export default Divider;
