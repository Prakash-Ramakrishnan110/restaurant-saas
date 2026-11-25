import React, { useState } from "react";
import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { dispatchThermalPrint, getThermalPrinterConfig } from "../../utils/thermalPrint";

export interface TokenSlipOrderData {
  order_number?: string;
  token_number?: number | null;
  placed_at?: string;
  items?: Array<{ item_name: string; quantity: number; notes?: string }>;
}

interface TokenSlipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantName: string;
  branchName?: string;
  order: TokenSlipOrderData | null;
}

export const TokenSlipModal: React.FC<TokenSlipModalProps> = ({
  open,
  onOpenChange,
  restaurantName,
  branchName,
  order,
}) => {
  const [printing, setPrinting] = useState(false);
  const cfg = getThermalPrinterConfig();

  if (!order || order.token_number == null) return null;

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await dispatchThermalPrint({
        slipType: "TOKEN",
        title: `${restaurantName} - Token #${order.token_number}`,
        lines: (order.items || []).map((it) => ({
          left: `${it.quantity}x ${it.item_name}`,
          right: "",
          bold: true,
        })),
        footer: [`Order: ${order.order_number || ""}`, "TOKEN SLIP - NOT A TAX INVOICE"],
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="token-slip-modal">
        <DialogHeader>
          <DialogTitle>Token Slip #{order.token_number} • டோக்கன் சீட்டு</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center py-2">
          <div
            className={`bg-white text-black font-mono text-xs p-4 rounded-lg border-2 border-dashed border-gray-300 shadow-inner space-y-3 ${
              cfg.paperWidth === "58" ? "w-56" : "w-72"
            }`}
          >
            <div className="text-center border-b border-dashed border-gray-400 pb-2 space-y-0.5">
              <div className="font-black text-sm uppercase">{restaurantName || "ServeMyFood"}</div>
              {branchName && <div className="text-[11px] text-gray-600">{branchName}</div>}
              <div className="text-[11px] font-bold text-gray-700 pt-1">
                TOKEN SLIP - NOT A TAX INVOICE
              </div>
              <div className="text-[11px] text-gray-600">டோக்கன் சீட்டு • கட்டண ரசீது அல்ல</div>
            </div>

            <div className="text-center py-2 border-b border-dashed border-gray-400">
              <div className="text-[11px] uppercase tracking-widest text-gray-600 font-bold">
                Counter Token • டோக்கன் எண்
              </div>
              <div
                className="text-5xl font-black tracking-tight text-black my-1"
                data-testid="token-slip-number"
              >
                #{order.token_number}
              </div>
              <div className="text-[11px] text-gray-600">
                {order.order_number || ""} •{" "}
                {order.placed_at
                  ? new Date(order.placed_at).toLocaleTimeString()
                  : new Date().toLocaleTimeString()}
              </div>
            </div>

            <div className="space-y-1 text-left">
              {(order.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between gap-2 text-xs font-semibold">
                  <span>
                    {it.quantity}x {it.item_name}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-center pt-2 border-t border-dashed border-gray-400 text-[10px] text-gray-600">
              Watch the Token TV for your number • தொலைக்காட்சி திரையில் எண் பார்க்கவும்
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[56px]"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            disabled={printing}
            className="min-h-[56px] bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold gap-2"
            data-testid="print-token-slip-btn"
          >
            <Printer className="h-4 w-4" />
            Print {cfg.paperWidth}mm Token Slip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
