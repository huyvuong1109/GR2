import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { Button, Input } from '../ui'
import { cn } from '../../utils/helpers'
import MetricTreeSelector from './MetricTreeSelector'
import FilterConditionBlock from './FilterConditionBlock'
import { FILTER_GROUPS, METHOD_PRESETS, METRIC_BY_ID } from './filterCatalog'
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

export default function DynamicScreenerPanel({ className, loadedSnapshot, onApplyFilters, onSaveFilters }) {
  const orderedFilterGroups = useMemo(
    () => [...FILTER_GROUPS].sort((a, b) => (a.id === 'by_method' ? -1 : b.id === 'by_method' ? 1 : 0)),
    []
  )
  const [activeFilterMode, setActiveFilterMode] = useState('by_method')
  const [selectedMetricIds, setSelectedMetricIds] = useState([])
  const [conditionsByMetric, setConditionsByMetric] = useState({})
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedMethodId, setSelectedMethodId] = useState(null)
  const [methodFiltersCollapsed, setMethodFiltersCollapsed] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveFilterName, setSaveFilterName] = useState('')
  const [saveNameError, setSaveNameError] = useState('')

  const activeFilterGroup = useMemo(
    () => FILTER_GROUPS.find((group) => group.id === activeFilterMode) || orderedFilterGroups[0],
    [activeFilterMode, orderedFilterGroups]
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
    setSelectedMethodId(null)
    setSelectedMetricIds((prev) => {
      if (checked) return prev.includes(metric.id) ? prev : [...prev, metric.id]
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
    if (metric) toggleMetric(metric, false)
  }

  const resetAllDynamicFilters = () => {
    setSelectedMetricIds([])
    setConditionsByMetric({})
    setSelectedMethodId(null)
    setMethodFiltersCollapsed(false)
    setStatusMessage('Đã xóa toàn bộ bộ lọc động')
  }

  const leafMetricsOf = (node) => {
    if (!node?.children?.length) return METRIC_BY_ID[node?.id] ? [METRIC_BY_ID[node.id]] : []
    return node.children.flatMap(leafMetricsOf)
  }

  const applyMethodPreset = (methodNode) => {
    const methodMetrics = leafMetricsOf(methodNode)
    const nextConditions = methodMetrics.reduce((acc, metric) => {
      acc[metric.id] = createDefaultCondition(metric)
      return acc
    }, {})

    setSelectedMetricIds(methodMetrics.map((metric) => metric.id))
    setConditionsByMetric(nextConditions)
    setSelectedMethodId(methodNode.id)
    setMethodFiltersCollapsed(false)
    setStatusMessage(`Đã nạp mẫu ${methodNode.label}. Có thể chỉnh từng ngưỡng trước khi lọc.`)
  }

  const methodPreset = METHOD_PRESETS[selectedMethodId]

  useEffect(() => {
    if (!loadedSnapshot) return

    setActiveFilterMode(loadedSnapshot.activeFilterMode || 'by_method')
    setSelectedMetricIds(Array.isArray(loadedSnapshot.selectedMetricIds) ? loadedSnapshot.selectedMetricIds : [])
    setConditionsByMetric(loadedSnapshot.conditionsByMetric || {})
    setSelectedMethodId(loadedSnapshot.selectedMethodId || null)
    setMethodFiltersCollapsed(false)
    setStatusMessage(`Đã tải bộ lọc "${loadedSnapshot.name || 'đã lưu'}".`)
  }, [loadedSnapshot])

  const createSnapshotData = () => {
    const selectedMethodLabel = activeFilterGroup?.children?.find((group) => group.id === selectedMethodId)?.label || null
    return {
      payload,
      queryParams,
      selectedMetricIds,
      conditionsByMetric,
      activeFilterMode,
      selectedMethodId,
      selectedMethodLabel,
    }
  }

  const openSaveDialog = () => {
    if (selectedMetricIds.length === 0) return
    setSaveFilterName('')
    setSaveNameError('')
    setSaveDialogOpen(true)
  }

  const closeSaveDialog = () => {
    setSaveDialogOpen(false)
    setSaveNameError('')
  }

  const saveWithCustomName = async (event) => {
    event.preventDefault()
    const name = saveFilterName.trim()
    if (!name) {
      setSaveNameError('Vui lòng nhập tên bộ lọc.')
      return
    }

    if (onSaveFilters) {
      await onSaveFilters({ ...createSnapshotData(), name })
      setStatusMessage(`Đã lưu bộ lọc "${name}"`)
    }
    closeSaveDialog()
  }

  const notifyParent = async (eventType) => {
    const selectedMethodLabel = activeFilterGroup?.children?.find((group) => group.id === selectedMethodId)?.label || null
    const data = {
      payload,
      queryParams,
      selectedMetricIds,
      conditionsByMetric,
      activeFilterMode,
      selectedMethodId,
      selectedMethodLabel,
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
            <h3 className="text-lg font-black text-slate-100">Chi tiết bộ lọc đa tầng</h3>
            <p className="mt-1 text-sm text-slate-500">
              Chọn nhóm chỉ tiêu và thêm các điều kiện để tinh chỉnh bộ lọc.
            </p>
          </div>

        </div>

        <div className="flex flex-wrap gap-2">
          {orderedFilterGroups.map((group) => {
            const active = activeFilterMode === group.id
            const modeMeta = FILTER_MODE_META[group.id] || { title: group.label, hint: group.description }
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setActiveFilterMode(group.id)
                  if (group.id !== 'by_method') setSelectedMethodId(null)
                }}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left transition-all',
                  active
                    ? 'border-emerald-300/35 bg-emerald-400/10 text-emerald-200'
                    : 'border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                )}
              >
                <p className="text-sm font-bold">{modeMeta.title}</p>
                <p className="mt-0.5 text-xs opacity-80">{modeMeta.hint}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 xl:col-span-5">
          <p className="mb-1 text-sm font-bold text-slate-200">Danh mục chỉ tiêu</p>
          <p className="mb-3 text-xs text-slate-500">{activeFilterGroup?.description}</p>

          <MetricTreeSelector
            tree={activeFilterGroup?.children || []}
            selectedMetricIds={selectedMetricIds}
            onToggleMetric={toggleMetric}
            onSelectGroup={activeFilterMode === 'by_method' ? applyMethodPreset : undefined}
            collapsedGroupId={activeFilterMode === 'by_method' && methodFiltersCollapsed ? selectedMethodId : null}
            onExpandCollapsedGroup={() => setMethodFiltersCollapsed(false)}
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 xl:col-span-7">
          {activeFilterMode === 'by_method' && methodPreset && (
            <div className="mb-4 rounded-lg border border-emerald-300/20 bg-emerald-400/[0.07] p-3 text-xs leading-5 text-slate-300">
              <p className="font-black text-emerald-300">{methodPreset.title}</p>
              <p className="mt-1 text-slate-400">{methodPreset.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {methodPreset.rules.map((rule) => (
                  <span key={rule} className="rounded-md border border-white/10 bg-black/20 px-2 py-1 font-bold text-slate-200">
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-200">Khu vực điều kiện lọc</p>
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterMode === 'by_method' && selectedMetricIds.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setMethodFiltersCollapsed((value) => !value)}
                >
                  {methodFiltersCollapsed ? <ChevronDown className="mr-1.5 h-4 w-4" /> : <ChevronUp className="mr-1.5 h-4 w-4" />}
                  {methodFiltersCollapsed ? 'Mở rộng' : 'Thu gọn'}
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={resetAllDynamicFilters}>
                Xóa tất cả
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={selectedMetricIds.length === 0} onClick={openSaveDialog}>
                Lưu bộ lọc
              </Button>
              <Button type="button" size="sm" disabled={selectedMetricIds.length === 0} onClick={() => notifyParent('apply')}>
                Lọc
              </Button>
            </div>
          </div>

          {selectedMetrics.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-500">
              Chưa có chỉ tiêu nào được chọn. Tick bên trái để tạo các khối điều kiện.
            </div>
          ) : activeFilterMode === 'by_method' && methodFiltersCollapsed ? (
            <button
              type="button"
              onClick={() => setMethodFiltersCollapsed(false)}
              className="w-full rounded-xl border border-dashed border-emerald-300/20 bg-emerald-400/[0.05] px-4 py-5 text-left text-sm text-slate-300 transition hover:border-emerald-300/35 hover:bg-emerald-400/[0.08]"
            >
              <span className="block font-black text-emerald-300">Đã thu gọn {selectedMetrics.length} điều kiện theo phương pháp</span>
              <span className="mt-1 block text-xs text-slate-500">Bấm để mở rộng và chỉnh từng ngưỡng lọc.</span>
            </button>
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

      {statusMessage && <p className="text-xs font-bold text-emerald-300">{statusMessage}</p>}

      {saveDialogOpen && (
        <div className="fixed inset-0 z-[110] flex min-h-dvh items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Đóng hộp thoại lưu bộ lọc"
            onClick={closeSaveDialog}
          />
          <form
            onSubmit={saveWithCustomName}
            className="glass-card relative w-full max-w-md overflow-hidden p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
          >
            <button
              type="button"
              onClick={closeSaveDialog}
              className="btn-ghost absolute right-3 top-3 p-2"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-8">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Lưu bộ lọc</p>
              <h3 className="mt-2 text-xl font-black text-slate-100">Đặt tên bộ lọc của bạn</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Tên này sẽ hiển thị trong danh sách bộ lọc đã lưu để bạn dễ áp dụng lại sau.
              </p>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">
                Tên bộ lọc
              </label>
              <Input
                autoFocus
                value={saveFilterName}
                onChange={(event) => {
                  setSaveFilterName(event.target.value)
                  if (saveNameError) setSaveNameError('')
                }}
                placeholder="Ví dụ: Value cổ phiếu giá rẻ"
                className="h-11 px-3 text-sm font-semibold"
              />
              {saveNameError && <p className="mt-2 text-sm text-red-300">{saveNameError}</p>}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeSaveDialog}>
                Hủy
              </Button>
              <Button type="submit">
                Lưu bộ lọc
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
