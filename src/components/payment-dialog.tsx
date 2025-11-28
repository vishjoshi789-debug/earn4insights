'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  productName: string;
}

export function PaymentDialog({
  isOpen,
  onClose,
  onConfirm,
  productName,
}: PaymentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">
            Unlock Full Report
          </DialogTitle>
          <DialogDescription>
            Confirm your one-time payment of $19.99 to download the detailed
            analytics report for {productName}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            This is a simulated payment for demonstration purposes.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <CreditCard className="mr-2 h-4 w-4" /> Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
