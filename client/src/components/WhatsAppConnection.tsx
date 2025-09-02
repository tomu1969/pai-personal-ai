import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PhoneIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';
import { whatsappApi } from '../services/api';
import { classNames } from '../utils';

interface WhatsAppStatus {
  connected: boolean;
  state: string;
  instanceId: string | null;
  lastConnection?: string | null;
  error?: string;
  timestamp: string;
}

interface QRCodeData {
  connected: boolean;
  qrCode?: string;
  qrCodeUrl?: string;
  instanceId?: string;
  message?: string;
  error?: string;
  timestamp: string;
}

const WhatsAppConnection: React.FC = () => {
  const [status, setStatus] = useState<WhatsAppStatus>({
    connected: false,
    state: 'loading',
    instanceId: null,
    timestamp: '',
  });
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingQR, setRefreshingQR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load connection status
  const loadStatus = async () => {
    try {
      setError(null);
      const statusData = await whatsappApi.getConnectionStatus();
      setStatus(statusData);
      
      // If disconnected, also load QR code
      if (!statusData.connected) {
        await loadQRCode();
      }
    } catch (err) {
      console.error('Failed to load WhatsApp status:', err);
      setError('Failed to check connection status');
    } finally {
      setLoading(false);
    }
  };

  // Load QR code
  const loadQRCode = async () => {
    try {
      setError(null);
      const qrCodeData = await whatsappApi.getQRCode();
      setQrData(qrCodeData);
      
      // Generate QR code canvas if we have QR data
      if (canvasRef.current) {
        if (qrCodeData.qrCodeUrl) {
          // Use the raw QR code string to generate canvas
          await QRCode.toCanvas(canvasRef.current, qrCodeData.qrCodeUrl, {
            width: 250,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
        } else if (qrCodeData.qrCode) {
          // If we have base64 image, create an image element and draw to canvas
          const img = new Image();
          img.onload = () => {
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && canvasRef.current) {
              canvasRef.current.width = 250;
              canvasRef.current.height = 250;
              ctx.drawImage(img, 0, 0, 250, 250);
            }
          };
          img.src = qrCodeData.qrCode;
        }
      }
    } catch (err) {
      console.error('Failed to load QR code:', err);
      setError('Failed to generate QR code');
    }
  };

  // Refresh QR code manually
  const handleRefreshQR = async () => {
    setRefreshingQR(true);
    await loadQRCode();
    setRefreshingQR(false);
  };

  // Initial load
  useEffect(() => {
    loadStatus();
  }, []);

  // Poll for status changes every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (status.connected) {
      return <CheckCircleIcon className="h-8 w-8 text-green-500" />;
    }
    
    if (status.state === 'error' || error) {
      return <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />;
    }
    
    return <PhoneIcon className="h-8 w-8 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (status.connected) {
      return {
        title: 'Connected',
        subtitle: `Instance: ${status.instanceId || 'Unknown'}`,
        color: 'text-green-400',
      };
    }
    
    if (status.state === 'error' || error) {
      return {
        title: 'Connection Error',
        subtitle: error || status.error || 'Unable to connect to WhatsApp',
        color: 'text-red-400',
      };
    }
    
    return {
      title: 'Disconnected',
      subtitle: 'Scan QR code to connect your phone',
      color: 'text-yellow-400',
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-text-secondary">
          <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Checking connection status...</p>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusText();

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-chat-bg border border-border-default rounded-lg p-6">
        <div className="flex items-center space-x-4 mb-4">
          {getStatusIcon()}
          <div>
            <h3 className={classNames('text-lg font-semibold', statusInfo.color)}>
              {statusInfo.title}
            </h3>
            <p className="text-text-secondary text-sm">{statusInfo.subtitle}</p>
          </div>
        </div>
        
        {status.connected && status.lastConnection && (
          <p className="text-xs text-text-secondary">
            Last connected: {new Date(status.lastConnection).toLocaleString()}
          </p>
        )}
      </div>

      {/* QR Code Section */}
      {!status.connected && !error && (
        <div className="bg-chat-bg border border-border-default rounded-lg p-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <QrCodeIcon className="h-6 w-6 text-text-primary" />
              <h3 className="text-lg font-semibold text-text-primary">
                Connect WhatsApp
              </h3>
            </div>
            
            {(qrData?.qrCodeUrl || qrData?.qrCode) && (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg">
                  <canvas
                    ref={canvasRef}
                    className="border border-gray-200 rounded"
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <div className="text-sm text-text-secondary space-y-1">
                <p><strong>Instructions:</strong></p>
                <ol className="list-decimal list-inside space-y-1 text-left max-w-md mx-auto">
                  <li>Open WhatsApp on your phone</li>
                  <li>Go to Settings → Linked Devices</li>
                  <li>Tap "Link a Device"</li>
                  <li>Scan this QR code</li>
                </ol>
              </div>
              
              <button
                onClick={handleRefreshQR}
                disabled={refreshingQR}
                className={classNames(
                  'flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors',
                  'text-sm font-medium',
                  refreshingQR
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-whatsapp-green-600 hover:bg-whatsapp-green-700 text-white'
                )}
              >
                <ArrowPathIcon className={classNames(
                  'h-4 w-4',
                  refreshingQR && 'animate-spin'
                )} />
                <span>{refreshingQR ? 'Refreshing...' : 'Refresh QR Code'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
            <div>
              <h4 className="text-red-400 font-medium">Connection Error</h4>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={loadStatus}
            className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default WhatsAppConnection;