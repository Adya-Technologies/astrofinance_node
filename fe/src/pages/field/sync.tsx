import React, { useState, useEffect } from 'react';
import { FiDownload, FiUpload, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import FieldLayout from '@/components/layout/FieldLayout';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import { syncService } from '@/services/syncService';
import { db } from '@/lib/db';
import { toast } from 'react-toastify';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

type SyncLog = {
    sessionId: string;
    timestamp: string;
    stats: {
        session: { status: 'ADDED' | 'SKIPPED' | 'PENDING' };
        entries: { added: number; skipped: number; transactionsCreated?: number };
        attendance: { added: number; skipped: number };
    };
};

const SyncPage = () => {
    const [downloading, setDownloading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);

    useEffect(() => {
        checkPending();
        const storedLastSync = localStorage.getItem('LAST_SYNC_TIME');
        if (storedLastSync) setLastSync(storedLastSync);
        loadHistory();
    }, []);

    const loadHistory = () => {
        const history = JSON.parse(localStorage.getItem('SYNC_HISTORY') || '[]');
        setSyncHistory(history);
    };

    const checkPending = async () => {
        const count = await db.sessions.where('status').equals('SUBMITTED').count();
        setPendingCount(count);
    };

    const handleDownload = async () => {
        if (!navigator.onLine) {
            toast.error('You must be online to download data');
            return;
        }
        setDownloading(true);
        const success = await syncService.downloadData();
        setDownloading(false);

        if (success) {
            toast.success('Data downloaded successfully');
            const now = new Date().toLocaleString();
            localStorage.setItem('LAST_SYNC_TIME', now);
            setLastSync(now);
        } else {
            toast.error('Download failed');
        }
    };

    const handleUpload = async () => {
        if (!navigator.onLine) {
            toast.error('You must be online to upload data');
            return;
        }
        setUploading(true);
        const result: any = await syncService.uploadData();
        setUploading(false);

        if (result.success) {
            if (result.count > 0) {
                toast.success(`Allocated ${result.count} sessions successfully`);
            } else {
                toast.info('No new data to upload');
            }
            checkPending();
            loadHistory();
        } else {
            toast.error('Upload failed');
        }
    };

    return (
        <FieldLayout title="Sync Data">
            <div className="space-y-6">
                <Card className="p-6 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-blue-100 p-4 rounded-full">
                            <FiDownload className="text-blue-600 text-3xl" />
                        </div>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Download Data</h2>
                    <p className="text-gray-500 mb-6">
                        Fetch the latest Centers, Groups, and Client lists from the server.
                    </p>
                    <Button
                        className="w-full"
                        onClick={handleDownload}
                        isLoading={downloading}
                        variant="primary"
                    >
                        {downloading ? 'Downloading...' : 'Download Data'}
                    </Button>
                    {lastSync && (
                        <p className="text-xs text-gray-400 mt-3">Last Synced: {lastSync}</p>
                    )}
                </Card>

                <Card className="p-6 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-green-100 p-4 rounded-full">
                            <FiUpload className="text-green-600 text-3xl" />
                        </div>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Upload Data</h2>
                    <p className="text-gray-500 mb-6">
                        Upload your offline collection sessions and attendance data.
                    </p>

                    {pendingCount > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded mb-4">
                            <strong>{pendingCount}</strong> sessions waiting to upload
                        </div>
                    )}

                    <Button
                        className="w-full"
                        onClick={handleUpload}
                        isLoading={uploading}
                        variant="outline"
                        disabled={pendingCount === 0}
                    >
                        {uploading ? 'Uploading...' : 'Upload Pending Data'}
                    </Button>
                </Card>

                {syncHistory.length > 0 && (
                    <Card className="p-4">
                        <h3 className="font-bold text-gray-800 mb-3 border-b pb-2">Recent Sync Activity</h3>
                        <div className="space-y-4">
                            {syncHistory.map((log, index) => (
                                <div key={index} className="flex flex-col text-sm border-b pb-2 last:border-0">
                                    <div className="flex justify-between items-start">
                                        <span className="text-gray-500 text-xs">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${log.stats.session.status === 'ADDED' ? 'bg-green-100 text-green-700' :
                                            log.stats.session.status === 'SKIPPED' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'
                                            }`}>
                                            {log.stats.session.status === 'ADDED' ? 'Success' : 'Duplicate'}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-gray-700">
                                        <div className="flex justify-between">
                                            <span>Entries:</span>
                                            <span>
                                                <span className="text-green-600">+{log.stats.entries.added}</span> /
                                                <span className="text-yellow-600"> {log.stats.entries.skipped} skip</span>
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Attendance:</span>
                                            <span>
                                                <span className="text-green-600">+{log.stats.attendance.added}</span> /
                                                <span className="text-yellow-600"> {log.stats.attendance.skipped} skip</span>
                                            </span>
                                        </div>
                                        {log.stats.entries.transactionsCreated !== undefined && (
                                            <div className="flex justify-between mt-1 pt-1 border-t border-gray-100">
                                                <span className="font-medium">💰 Transactions:</span>
                                                <span className="text-blue-600 font-bold">
                                                    {log.stats.entries.transactionsCreated} Posted
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
        </FieldLayout>
    );
};

export async function getServerSideProps({ locale }: { locale: string }) {
    return {
        props: {
            ...(await serverSideTranslations(locale, ['common'])),
        },
    };
}

export default SyncPage;
