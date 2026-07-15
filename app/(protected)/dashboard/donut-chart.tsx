'use client';

/**
 * Recharts DonutChart — imported as a single lazy bundle via dynamic() in page.tsx.
 * Recharts relies on React.Children identity checks (child.type === Cell), so all
 * recharts primitives MUST live in the same module scope as their parent chart.
 */
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Item {
  label: string;
  count: number;
  color?: string;
  href?: string;
}

export default function DonutChart({ items, total }: { items: Item[]; total?: number }) {
  const router = useRouter();
  // Only render segments that have actual data
  const data = items.filter(i => i.count > 0);
  const sum = total ?? data.reduce((s, i) => s + i.count, 0);
  const anyClickable = data.some(i => !!i.href);

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            innerRadius="60%"
            outerRadius="88%"
            strokeWidth={0}
            paddingAngle={data.length > 1 ? 2 : 0}
            cornerRadius={4}
            onClick={(_, index) => {
              const href = data[index]?.href;
              if (href) router.push(href);
            }}
            style={{ cursor: anyClickable ? 'pointer' : 'default', outline: 'none' }}
          >
            {data.map((item, idx) => (
              <Cell key={idx} fill={item.color ?? '#6B7280'} style={{ outline: 'none' }} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              padding: '6px 10px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Total in the donut hole */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-bold text-text-primary tabular-nums leading-none tracking-tight">
          {sum.toLocaleString()}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-text-secondary mt-1">Total</span>
      </div>
    </div>
  );
}
