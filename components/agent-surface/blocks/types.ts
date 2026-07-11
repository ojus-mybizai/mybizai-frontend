import type { Block, Callback } from '@/lib/agent-blocks';

/**
 * Every block renderer is presentational: it receives its (narrowed) block plus
 * an onCallback and a disabled flag. Renderers hold NO fetch logic — interactions
 * are funnelled up through onCallback.
 */
export interface BlockProps<B extends Block = Block> {
  block: B;
  onCallback: (cb: Callback) => void;
  disabled: boolean;
}
