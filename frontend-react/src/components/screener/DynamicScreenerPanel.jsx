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
    title: 'Theo chỉ số',
    hint: 'ROE, P/E, biên lợi nhuận, đòn bẩy, tăng trưởng.',
  },
  by_method: {
    title: 'Theo phương pháp',
    hint: 'Value, CANSLIM, GARP, chất lượng.',
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
    setStatusMessage('Đã xoá toàn bộ bộ lọc động')
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
      setStatusMessage(`Đã gửi ${payload.length} điều kiện lọc đến API`)
    }

    if (eventType === 'save' && onSaveFilters) {
      await onSaveFilters(data)
      setStatusMessage(`Đã lưu ${payload.length} điều kiện lọc`)
    }
  }

  return (
    <div className={cn('relative flex flex-col gap-6', className)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Chi tiết bộ lọc đa tầng</h3>
            <p className="mt-1 text-sm text-slate-600">
              Chọn nhóm chỉ tiêu và thêm các điều kiện để tinh chỉnh bộ lọc.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="border-slate-200 bg-primary-50 text-slate-700">{selectedMetricIds.length} chỉ tiêu</Badge>
            <Badge className="border-slate-200 bg-purple-50 text-purple-700">{payload.length} điều kiện hợp lệ</Badge>
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
                    ? 'border-slate-200 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-primary-50'
                )}
              >
                <p className="text-sm font-semibold">{modeMeta.title}</p>
                <p className="mt-0.5 text-xs opacity-80">{modeMeta.hint}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 xl:col-span-5">
            <p className="mb-1 text-sm font-semibold text-slate-700">Danh mục chỉ tiêu</p>
            <p className="mb-3 text-xs text-slate-600">{activeFilterGroup?.description}</p>

            <MetricTreeSelector
              tree={activeFilterGroup?.children || []}
              selectedMetricIds={selectedMetricIds}
              onToggleMetric={toggleMetric}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 xl:col-span-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">Khu vực điều kiện lọc</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={resetAllDynamicFilters}>
                  Xoá tất cả
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={selectedMetricIds.length === 0}
                  onClick={() => notifyParent('save')}
                >
                  Lưu bộ lọc
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedMetricIds.length === 0}
                  onClick={() => notifyParent('apply')}
                >
                  Lọc
                </Button>
              </div>
            </div>

            {selectedMetrics.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                Chưa có chỉ tiêu nào được chọn. Tick bên trái để tạo các khối điều kiện.
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

        {statusMessage && (
          <p className="mt-3 text-xs text-success-600">{statusMessage}</p>
        )}
      </div>
    </div>
  )
}