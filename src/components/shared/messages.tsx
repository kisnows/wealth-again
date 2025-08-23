"use client";

import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageProps {
  type: "success" | "error" | "warning" | "info";
  message: string;
  onClose?: () => void;
  className?: string;
}

/**
 * 通用消息提示组件
 */
export function Message({ type, message, onClose, className = "" }: MessageProps) {
  if (!message) return null;

  const baseClasses = "px-4 py-3 rounded border flex items-center gap-3";
  const typeClasses = {
    success: "bg-green-50 border-green-200 text-green-700",
    error: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-600" />,
    error: <AlertCircle className="w-5 h-5 text-red-600" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-600" />,
    info: <Info className="w-5 h-5 text-blue-600" />,
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]} ${className}`}>
      {icons[type]}
      <span className="flex-1">{message}</span>
      {onClose && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="p-0 h-auto hover:bg-transparent"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * 消息容器组件
 */
interface MessagesContainerProps {
  error?: string;
  success?: string;
  warning?: string;
  info?: string;
  onClearError?: () => void;
  onClearSuccess?: () => void;
  onClearWarning?: () => void;
  onClearInfo?: () => void;
  className?: string;
}

export function MessagesContainer({
  error,
  success,
  warning,
  info,
  onClearError,
  onClearSuccess,
  onClearWarning,
  onClearInfo,
  className = "",
}: MessagesContainerProps) {
  const messages = [
    { type: "error" as const, message: error, onClear: onClearError },
    { type: "success" as const, message: success, onClear: onClearSuccess },
    { type: "warning" as const, message: warning, onClear: onClearWarning },
    { type: "info" as const, message: info, onClear: onClearInfo },
  ].filter((m) => m.message);

  if (messages.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {messages.map((msg, index) => (
        <Message
          key={`${msg.type}-${index}`}
          type={msg.type}
          message={msg.message!}
          onClose={msg.onClear}
        />
      ))}
    </div>
  );
}
