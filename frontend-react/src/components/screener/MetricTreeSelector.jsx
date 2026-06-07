import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge } from '../ui'
import { cn } from '../../utils/helpers'

function buildExpandedState(nodes, expanded = {}) {
  nodes.forEach((node) => {
    if (node.children?.length) {
      expanded[node.id] = true
      buildExpandedState(node.children, expanded)
    }
  })
  return expanded
}

function isLeafNode(node) {
  return !node.children || node.children.length === 0
}

function hasOnlyLeafChildren(node) {
  return node.children?.length > 0 && node.children.every(isLeafNode)
}

export default function MetricTreeSelector({ tree, selectedMetricIds, onToggleMetric, onSelectGroup }) {
  const [expandedNodes, setExpandedNodes] = useState(() => buildExpandedState(tree))
  const selectedSet = useMemo(() => new Set(selectedMetricIds), [selectedMetricIds])

  const toggleExpandNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }))
  }

  const renderNode = (node, depth = 0) => {
    if (isLeafNode(node)) {
      const isChecked = selectedSet.has(node.id)

      return (
        <label
          key={node.id}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors',
            isChecked ? 'border-emerald-300/35 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
          )}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          <input
            type="checkbox"
            className="mt-1 rounded border-white/20 bg-black/30 text-emerald-400"
            checked={isChecked}
            onChange={(event) => onToggleMetric(node, event.target.checked)}
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-100">{node.label}</p>
            {node.description && (
              <p className="mt-0.5 text-xs text-slate-500">{node.description}</p>
            )}
          </div>

          <Badge variant="secondary" size="sm" className="shrink-0">
            {node.unit}
          </Badge>
        </label>
      )
    }

    const isExpanded = expandedNodes[node.id]
    const selectableGroup = onSelectGroup && hasOnlyLeafChildren(node)

    return (
      <div key={node.id} className="space-y-2">
        <button
          type="button"
          onClick={() => {
            if (selectableGroup) {
              onSelectGroup(node)
              setExpandedNodes((prev) => ({ ...prev, [node.id]: true }))
              return
            }
            toggleExpandNode(node.id)
          }}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-bold text-slate-300 hover:bg-white/[0.05]',
            selectableGroup && 'border border-white/10 bg-white/[0.03] hover:border-emerald-300/30 hover:text-emerald-200'
          )}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
          <span>{node.label}</span>
          {selectableGroup && (
            <Badge variant="secondary" size="sm" className="ml-auto">
              Mẫu
            </Badge>
          )}
        </button>

        {isExpanded && (
          <div className="space-y-2">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return <div className="space-y-3">{tree.map((node) => renderNode(node))}</div>
}
