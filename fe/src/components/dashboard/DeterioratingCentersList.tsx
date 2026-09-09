import React from 'react';
import { useRouter } from 'next/router';

export interface DeterioratingCenter {
    centerId: string;
    centerName: string;
    trendScore: number;
    reasons: string[];
    lastMeetingDate: string | null;
    assignedOfficer: string;
}

interface DeterioratingCentersListProps {
    centers: DeterioratingCenter[];
    isLoading?: boolean;
}

const DeterioratingCentersList: React.FC<DeterioratingCentersListProps> = ({
    centers,
    isLoading = false
}) => {
    const router = useRouter();

    const getScoreColor = (score: number): string => {
        if (score >= 60) return 'text-red-700 bg-red-50 border-red-500';
        if (score >= 30) return 'text-yellow-700 bg-yellow-50 border-yellow-500';
        return 'text-blue-700 bg-blue-50 border-blue-500';
    };

    const formatReason = (reason: string): string => {
        return reason
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const formatDate = (dateString: string | null): string => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    if (isLoading) {
        return (
            <div className="text-center py-8 text-gray-500 text-sm">
                Analyzing center trends...
            </div>
        );
    }

    if (centers.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-3">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">No Deteriorating Centers Detected</p>
                <p className="text-xs text-gray-500 mt-1">All centers are performing within normal parameters</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {centers.map((center, index) => (
                <div
                    key={center.centerId}
                    className={`border-l-4 p-4 rounded-r-lg cursor-pointer transition-all hover:shadow-md ${getScoreColor(center.trendScore)}`}
                    onClick={() => router.push(`/admin/centers/${center.centerId}`)}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            {/* Center name and rank */}
                            <div className="flex items-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-700 text-white text-xs font-bold mr-2">
                                    {index + 1}
                                </span>
                                <h3 className="text-sm font-semibold text-gray-900">
                                    {center.centerName}
                                </h3>
                            </div>

                            {/* Reasons - tags */}
                            <div className="mt-2 flex flex-wrap gap-1">
                                {center.reasons.map((reason) => (
                                    <span
                                        key={reason}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white bg-opacity-50"
                                    >
                                        {formatReason(reason)}
                                    </span>
                                ))}
                            </div>

                            {/* Metadata */}
                            <div className="mt-2 flex items-center text-xs text-gray-600 space-x-4">
                                <span className="flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    {center.assignedOfficer}
                                </span>
                                <span className="flex items-center">
                                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {formatDate(center.lastMeetingDate)}
                                </span>
                            </div>
                        </div>

                        {/* Trend score badge */}
                        <div className="flex-shrink-0 ml-4">
                            <div className="flex flex-col items-center">
                                <div className={`text-2xl font-bold ${center.trendScore >= 60 ? 'text-red-700' : center.trendScore >= 30 ? 'text-yellow-700' : 'text-blue-700'}`}>
                                    {center.trendScore}
                                </div>
                                <div className="text-xs text-gray-500 uppercase tracking-wide">Score</div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 italic">
                    💡 Tip: Higher scores indicate more deterioration. Prioritize centers with scores &gt; 60 for immediate intervention.
                </p>
            </div>
        </div>
    );
};

export default DeterioratingCentersList;
