import { OpsStateFrame, type OpsStateFrameProps } from './section-state'

export {
  classifyOpsFailure,
  type OpsStateKind,
  resolveOpsState,
  useOpsBoundedRetry,
  useOpsWritesEnabled
} from './section-state'

/** W10 node wrapper: same states as a section, compact, tied to one node's own query. */
export function OpsNodeState(props: OpsStateFrameProps) {
  return <OpsStateFrame {...props} variant="node" />
}
