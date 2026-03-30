/**
 * Web Vitals reporting utility.
 *
 * Reports Core Web Vitals (LCP, CLS, INP) and supplementary metrics (FCP, TTFB)
 * to the console in development and to an optional analytics endpoint in production.
 *
 * Usage: call `reportWebVitals()` once on app mount (e.g., in a client component).
 */

type MetricHandler = (metric: {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
}) => void;

const DEV = process.env.NODE_ENV === 'development';

const handler: MetricHandler = (metric) => {
  if (DEV) {
    const color =
      metric.rating === 'good'
        ? 'color: green'
        : metric.rating === 'needs-improvement'
          ? 'color: orange'
          : 'color: red';
    // eslint-disable-next-line no-console
    console.log(`%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(1)} (${metric.rating})`, color);
  }

  // In production, send to your analytics endpoint:
  // const analyticsUrl = process.env.NEXT_PUBLIC_ANALYTICS_URL;
  // if (analyticsUrl) {
  //   navigator.sendBeacon(analyticsUrl, JSON.stringify(metric));
  // }
};

export async function reportWebVitals() {
  if (typeof window === 'undefined') return;

  try {
    const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');
    onCLS(handler);
    onINP(handler);
    onLCP(handler);
    onFCP(handler);
    onTTFB(handler);
  } catch {
    // web-vitals not installed — skip silently
    if (DEV) {
      // eslint-disable-next-line no-console
      console.info('[Web Vitals] Install `web-vitals` package to enable metrics: npm i web-vitals');
    }
  }
}
