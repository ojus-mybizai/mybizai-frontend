'use client';

/**
 * Recharts DonutChart — imported as a single lazy bundle via dynamic() in page.tsx.
 * Recharts relies on React.Children identity checks (child.type === Cell), so all
 * recharts primitives MUST live in the same module scope as their parent chart.
 */
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Item {
  label: string;
  count: number;
  color?: string;
}

export default function DonutChart({ items }: { items: Item[] }) {
  // Only render segments that have actual data
  const data = items.filter(i => i.count > 0);

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          innerRadius="55%"
          outerRadius="82%"
          strokeWidth={0}
          paddingAngle={data.length > 1 ? 3 : 0}
        >
          {data.map((item, idx) => (
            <Cell key={idx} fill={item.color ?? '#6B7280'} />
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
  );
}
