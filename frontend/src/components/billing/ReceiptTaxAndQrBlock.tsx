import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatRupees } from "../../utils/currency";

interface TaxBreakdownProps {
  subtotalPaise: number;
  discountPaise?: number;
  taxablePaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  taxPaise?: number;
  taxRatePercent?: string | number;
  taxMode?: "INCLUSIVE" | "EXCLUSIVE";
  totalPaise: number;
}

export const ReceiptTaxBreakdown: React.FC<TaxBreakdownProps> = ({
  subtotalPaise,
  discountPaise = 0,
  taxablePaise = 0,
  cgstPaise = 0,
  sgstPaise = 0,
  taxPaise = 0,
  taxRatePercent = 0,
  taxMode = "INCLUSIVE",
  totalPaise,
}) => {
  const rateNum = Number(taxRatePercent || 0);
  const halfRate = (rateNum / 2).toFixed(rateNum % 2 === 0 ? 1 : 2);

  return (
    <div className="py-1 text-xs space-y-0.5">
      <div className="flex justify-between">
        <span>Subtotal:</span>
        <span>{formatRupees(subtotalPaise)}</span>
      </div>
      {discountPaise > 0 && (
        <div className="flex justify-between">
          <span>Discount:</span>
          <span>-{formatRupees(discountPaise)}</span>
        </div>
      )}
      {taxPaise > 0 && (
        <>
          <div className="flex justify-between text-gray-600">
            <span>Taxable Amt ({taxMode === "INCLUSIVE" ? "Incl." : "Excl."}):</span>
            <span>{formatRupees(taxablePaise)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>CGST ({halfRate}%):</span>
            <span>{formatRupees(cgstPaise)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>SGST ({halfRate}%):</span>
            <span>{formatRupees(sgstPaise)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
        <span>NET TOTAL:</span>
        <span>{formatRupees(totalPaise)}</span>
      </div>
    </div>
  );
};

interface ReviewQrFooterProps {
  reviewQrUrl?: string;
  reviewQrLabel?: string;
  receiptFooterText?: string;
}

export const ReviewQrFooter: React.FC<ReviewQrFooterProps> = ({
  reviewQrUrl,
  reviewQrLabel,
  receiptFooterText,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const target = (reviewQrUrl || "").trim();
    if (!target) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(target, { width: 128, margin: 1 })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [reviewQrUrl]);

  return (
    <div className="text-center pt-2 border-t border-dashed border-gray-400 text-xs text-gray-600 space-y-1.5">
      {qrDataUrl && (
        <div className="flex flex-col items-center py-1">
          <img src={qrDataUrl} alt="Review QR" className="w-24 h-24 object-contain" />
          <p className="text-[11px] font-semibold text-black mt-0.5">
            {reviewQrLabel || "Scan to leave us a review"}
          </p>
        </div>
      )}
      {receiptFooterText && <p className="text-[11px] font-medium">{receiptFooterText}</p>}
      <p>Thank you! Visit again.</p>
      <p>Powered by ServeMyFood</p>
    </div>
  );
};
