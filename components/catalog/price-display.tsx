'use client';

interface PriceDisplayProps {
  amount: number;
  currency: string;
  className?: string;
}

export function PriceDisplay({ amount, currency, className }: PriceDisplayProps) {
  return (
    <span className={className}>
      {currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}
