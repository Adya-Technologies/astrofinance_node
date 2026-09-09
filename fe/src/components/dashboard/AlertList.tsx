import React from 'react';
import { useRouter } from 'next/router';

export interface AlertItem {
    id: string;
    title: string;
    subtitle?: string;
    severity: 'critical' | 'warning' | 'info';
    href?: string;
    onClick?: () => void;
}

interface AlertListProps {
    items: AlertItem[];
    emptyMessage?: string;
}

const AlertList: React.FC<AlertListProps> = ({
    items,
    emptyMessage = 'No alerts at this time'
}) => {
    const router = useRouter();

    const getSeverityStyles = (severity: 'critical' | 'warning' | 'info') => {
        switch (severity) {
            case 'critical':
                return {
                    bg: 'bg-red-50 hover:bg-red-100',
                    border: 'border-l-4 border-red-500',
                    dot: 'bg-red-500'
                };
            case 'warning':
                return {
                    bg: 'bg-yellow-50 hover:bg-yellow-100',
                    border: 'border-l-4 border-yellow-500',
                    dot: 'bg-yellow-500'
                };
            case 'info':
                return {
                    bg: 'bg-blue-50 hover:bg-blue-100',
                    border: 'border-l-4 border-blue-500',
                    dot: 'bg-blue-500'
                };
        }
    };

    const handleClick = (item: AlertItem) => {
        if (item.onClick) {
            item.onClick();
        } else if (item.href) {
            router.push(item.href);
        }
    };

    // Sort items by severity (critical > warning > info)
    const sortedItems = [...items].sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });

    if (items.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 text-sm">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {sortedItems.map((item) => {
                const styles = getSeverityStyles(item.severity);
                const isClickable = !!(item.onClick || item.href);

                return (
                    <div
                        key={item.id}
                        className={`
              ${styles.bg} ${styles.border} 
              p-4 rounded transition-colors
              ${isClickable ? 'cursor-pointer' : ''}
            `}
                        onClick={() => isClickable && handleClick(item)}
                    >
                        <div className="flex items-start">
                            {/* Severity dot indicator */}
                            <div className="flex-shrink-0 mt-1">
                                <span className={`inline-block w-2 h-2 rounded-full ${styles.dot}`} />
                            </div>

                            {/* Content */}
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                    {item.title}
                                </p>
                                {item.subtitle && (
                                    <p className="text-xs text-gray-600 mt-1">
                                        {item.subtitle}
                                    </p>
                                )}
                            </div>

                            {/* Arrow icon if clickable */}
                            {isClickable && (
                                <div className="flex-shrink-0 ml-2">
                                    <svg
                                        className="w-5 h-5 text-gray-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default AlertList;
