import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '../ui'
import { cn } from '../../utils/helpers'
import MetricTreeSelector from './MetricTreeSelector'
import FilterConditionBlock from './FilterConditionBlock'
import { FILTER_GROUPS, METRIC_BY_ID } from './filterCatalog'
import {
  buildAdvancedQueryFromPayload,
  buildDynamicPayload,
  createDefaultCondition,
} from './filterPayload'

const FILTER_MODE_META = {
  by_index: {
    title: 'Theo chi so',
    hint: 'ROE, P/E, bien loi nhuan, don bay, tang truong.',
  },
  by_method: {
    title: 'Theo phuong phap',
    hint: 'Value, CANSLIM, GARP, Quality Compounder.',
  },
}

export default function DynamicScreenerPanel({
  className,
  onApplyFilters,
  onSaveFilters,
}) {
  const [activeFilterMode, setActiveFilterMode] = useState(FILTER_GROUPS[0]?.id || 'by_index')
  const [selectedMetricIds, setSelectedMetricIds] = useState([])
  const [conditionsByMetric, setConditionsByMetric] = useState({})
  const [statusMessage, setStatusMessage] = useState('')

  const activeFilterGroup = useMemo(
    () => FILTER_GROUPS.find((group) => group.id === activeFilterMode) || FILTER_GROUPS[0],
    [activeFilterMode]
  )

  const selectedMetrics = useMemo(
    () => selectedMetricIds.map((metricId) => METRIC_BY_ID[metricId]).filter(Boolean),
    [selectedMetricIds]
  )

  const payload = useMemo(
    () => buildDynamicPayload({ selectedMetricIds, conditionsByMetric, metricById: METRIC_BY_ID }),
    [selectedMetricIds, conditionsByMetric]
  )

  const queryParams = useMemo(
    () => buildAdvancedQueryFromPayload(payload, METRIC_BY_ID),
    [payload]
  )

  const toggleMetric = (metric, checked) => {
    setSelectedMetricIds((prev) => {
      if (checked) {
        return prev.includes(metric.id) ? prev : [...prev, metric.id]
      }

      return prev.filter((metricId) => metricId !== metric.id)
    })

    setConditionsByMetric((prev) => {
      if (checked) {
        return {
          ...prev,
          [metric.id]: prev[metric.id] || createDefaultCondition(metric),
        }
      }

      const next = { ...prev }
      delete next[metric.id]
      return next
    })
  }

  const updateCondition = (metricId, patch) => {
    setConditionsByMetric((prev) => {
      const metric = METRIC_BY_ID[metricId]
      const current = prev[metricId] || createDefaultCondition(metric)

      return {
        ...prev,
        [metricId]: {
          ...current,
          ...patch,
          timeSeries: patch.timeSeries
            ? {
                ...current.timeSeries,
                ...patch.timeSeries,
              }
            : current.timeSeries,
        },
      }
    })
  }

  const removeMetric = (metricId) => {
    const metric = METRIC_BY_ID[metricId]
    if (!metric) {
      return
    }
    toggleMetric(metric, false)
  }

  const resetAllDynamicFilters = () => {
    setSelectedMetricIds([])
    setConditionsByMetric({})
    setStatusMessage('Da xoa toan bo bo loc dong')
  }

  const notifyParent = async (eventType) => {
    const data = {
      payload,
      queryParams,
      selectedMetricIds,
      conditionsByMetric,
    }

    if (eventType === 'apply' && onApplyFilters) {
      await onApplyFilters(data)
      setStatusMessage(`Da gui ${payload.length} dieu kien loc den API`)
    }

    if (eventType === 'save' && onSaveFilters) {
      await onSaveFilters(data)
      setStatusMessage(`Da luu ${payload.length} dieu kien loc`)
    }
  }

  return (
    <Card className={cn('relative overflow-hidden border-blue-500/20 bg-slate-900/70', className)}>
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />

      <CardHeader className="relative mb-0 flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-white">Bo loc co phieu da tang mode</CardTitle>
            <p className="mt-1 text-sm text-blue-200/70">
              Tach 2 nhanh loc ro rang: Theo chi so hoac Theo phuong phap. Trong moi nhanh se chia nho them.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">{selectedMetricIds.length} chi tieu</Badge>
            <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-200">{payload.length} dieu kien hop le</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTER_GROUPS.map((group) => {
            const active = activeFilterMode === group.id
            const modeMeta = FILTER_MODE_META[group.id] || { title: group.label, hint: group.description }

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveFilterMode(group.id)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left transition-all',
                  active
                    ? 'border-blue-400/45 bg-gradient-to-r from-blue-500/25 to-purple-500/25 text-blue-50'
                    : 'border-blue-500/20 bg-slate-950/55 text-blue-200/75 hover:bg-blue-500/10'
                )}
              >
                <p className="text-sm font-semibold">{modeMeta.title}</p>
                <p className="mt-0.5 text-xs opacity-80">{modeMeta.hint}</p>
              </button>
            )
          })}
        </div>
      </CardHeader>

      <CardContent className="relative pt-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="rounded-xl border border-blue-500/20 bg-slate-950/60 p-4 xl:col-span-5">
            <p className="mb-1 text-sm font-semibold text-blue-100">Danh muc chi tieu</p>
            <p className="mb-3 text-xs text-blue-200/60">{activeFilterGroup?.description}</p>

            <MetricTreeSelector
              tree={activeFilterGroup?.children || []}
              selectedMetricIds={selectedMetricIds}
              onToggleMetric={toggleMetric}
            />
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-slate-950/60 p-4 xl:col-span-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-blue-100">Khu vuc dieu kien loc</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={resetAllDynamicFilters}>
                  Xoa tat ca
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={selectedMetricIds.length === 0}
                  onClick={() => notifyParent('save')}
                >
                  Luu bo loc
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedMetricIds.length === 0}
                  onClick={() => notifyParent('apply')}
                >
                  Loc
                </Button>
              </div>
            </div>

            {selectedMetrics.length === 0 ? (
              <div className="rounded-xl border border-dashed border-blue-500/25 bg-slate-900/55 px-4 py-8 text-center text-sm text-blue-200/60">
                Chua co chi tieu nao duoc chon. Tick ben trai de tao cac Filter Block.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedMetrics.map((metric) => (
                  <FilterConditionBlock
                    key={metric.id}
                    metric={metric}
                    condition={conditionsByMetric[metric.id]}
                    onChange={updateCondition}
                    onRemove={removeMetric}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-200">
            Payload JSON gui xuong API
          </p>
          <pre className="max-h-56 overflow-auto text-xs text-blue-100">
            {JSON.stringify(payload, null, 2)}
          </pre>
          <p className="mt-2 text-xs text-blue-300">
            Nut Loc gui payload va map sang query params de tuong thich voi endpoint screener hien tai.
          </p>
        </div>

        {statusMessage && (
          <p className="mt-3 text-xs text-emerald-300">{statusMessage}</p>
        )}
      </CardContent>
    </Card>
  )
}