import { useState, type PropsWithChildren, type ReactNode } from "react";

import styles from "./Tree.module.css";

type TreeNodeProps = PropsWithChildren<{
    Title: ReactNode;
}>;

export function TreeNode({ Title, children }: TreeNodeProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={styles.treeNode}>
            <button
                className={styles.treeNodeHeader}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <span>{isOpen ? "▼" : "▶"}</span>
                <span>{Title}</span>
            </button>

            {isOpen && (
                <div className={styles.treeNodeChildren}>
                    {children}
                </div>
            )}
        </div>
    );
}