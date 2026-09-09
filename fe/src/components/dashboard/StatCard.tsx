import React from 'react';

interface StatCardProps {
    label: string;
    value: number | string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: number;
    status?: 'green' | 'yellow' | 'red';
    onClick?: () => void;
    unit?: string;
    decimals?: number;
}

const StatCard: React.FC<StatCardProps> = ({
    label,
    value,
    trend,
    trendValue,
    status = 'green',
    onClick,
    unit = '',
    decimals = 2
}) => {
    // Format value with appropriate decimals
    const formattedValue = typeof value === 'number'
        ? value.toFixed(decimals)
        : value;

    // Determine background and text colors based on status
    const getStatusColors = () => {
        switch (status) {
            case 'green':
                return 'bg-white border-green-500 hover:border-green-600';
            case 'yellow':
                return 'bg-yellow-50 border-yellow-500 hover:border-yellow-600';
            case 'red':
                return 'bg-red-50 border-red-500 hover:border-red-600';
            default:
                return 'bg-white border-gray-300 hover:border-gray-400';
        }
    };

    const getValueColor = () => {
        switch (status) {
            case 'green':
                return 'text-gray-900';
            case 'yellow':
                return 'text-yellow-900';
            case 'red':
                return 'text-red-900';
            default:
                return 'text-gray-900';
        }
    };

    const getTrendIcon = () => {
        if (!trend || trend === 'neutral') return null;

        if (trend === 'up') {
            return (
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
            );
        }

        return (
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
        );
    };

    const getTrendColor = () => {
        if (!trend || trend === 'neutral') return 'text-gray-500';
        return trend === 'up' ? 'text-green-600' : 'text-red-600';
    };

    return (
        <div
            className={`border-l-4 p-5 rounded-lg shadow-sm transition-all ${getStatusColors()} ${onClick ? 'cursor-pointer' : ''
                }`}
            onClick={onClick}
        >
            <div className="flex flex-col">
                {/* Label - small and gray */}
                <dt className="text-sm font-medium text-gray-500 truncate mb-2">
                    {label}
                </dt>

                {/* Value - large and prominent */}
                <dd className={`text-3xl font-bold ${getValueColor()}`}>
                    {formattedValue}{unit && <span className="text-lg ml-1">{unit}</span>}
                </dd>

                {/* Trend indicator - optional */}
                {trend && trend !== 'neutral' && trendValue !== undefined && (
                    <div className={`flex items-center mt-2 text-sm ${getTrendColor()}`}>
                        {getTrendIcon()}
                        <span className="ml-1">
                            {Math.abs(trendValue).toFixed(1)}{unit}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
