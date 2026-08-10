import {
    useState,
    type PropsWithChildren,
    type ReactNode,
    type MouseEvent,
} from "react";

import { useTreeContext } from "./TreeContext";
import styles from "./Tree.module.css";

type TreeNodeProps = PropsWithChildren<{
    nodeKey: string;
    Title: ReactNode;
}>;

export function TreeNode({
    nodeKey,
    Title,
    children,
}: TreeNodeProps) {
    const [isOpen, setIsOpen] = useState(false);

    const { selectedKey, select } = useTreeContext();

    const isSelected = selectedKey === nodeKey;
    const hasChildren = Boolean(children);

    const handleClick = () => {
        select(nodeKey);

        if (hasChildren) {
            setIsOpen((prev) => !prev);
        }
    };

    return (
        <div className={styles.treeNode}>
            <div
                className={`${styles.treeNodeHeader} ${isSelected ? styles.isSelected : ""
                    }`}
                data-selected={isSelected || undefined}
                onClick={handleClick}
            >
                {hasChildren && (
                    <span
                        className={styles.treeNodeArrow}
                        style={{
                            transform: isOpen
                                ? "rotate(90deg)"
                                : "rotate(0deg)",
                        }}
                    >
                        ▶
                    </span>
                )}

                <span>{Title}</span>
            </div>

            {isOpen && hasChildren && (
                <div className={styles.treeNodeChildren}>
                    {children}
                </div>
            )}
        </div>
    );
}