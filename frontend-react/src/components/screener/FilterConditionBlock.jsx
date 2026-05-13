import { X } from 'lucide-react'
import { Badge, Button, Input, Select } from '../ui'
import {
  DYNAMIC_OPERATOR_OPTIONS,
  TIME_SERIES_COMPARATOR_OPTIONS,
  PERIOD_TYPE_OPTIONS,
} from './filterCatalog'

const PERIOD_UNIT_LABEL = {
  quarter: 'quý',
  year: 'năm',
}

export default function FilterConditionBlock({ metric, condition, onChange, onRemove }) {
  const activeOperator = condition?.operator || 'all'
  const timeSeries = condition?.timeSeries || {}

  const patchCondition = (patch) => onChange(metric.id, patch)

  const patchTimeSeries = (patch) => {
    patchCondition({
      timeSeries: {
        ...timeSeries,
        ...patch,
      },
    })
  }

  const periodType = timeSeries.periodType || metric.defaultPeriodType || 'quarter'

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-100">{metric.label}</p>
          {metric.description && <p className="mt-1 text-xs text-slate-500">{metric.description}</p>}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" size="sm">
            {activeOperator === 'lien_tiep' ? PERIOD_UNIT_LABEL[periodType] : metric.unit}
          </Badge>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-slate-500 hover:text-red-300"
            onClick={() => onRemove(metric.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <FieldLabel label="Phép so sánh">
          <Select
            options={DYNAMIC_OPERATOR_OPTIONS}
            value={activeOperator}
            onChange={(event) => patchCondition({ operator: event.target.value })}
          />
        </FieldLabel>

        {activeOperator === 'range' && (
          <>
            <FieldLabel label="Từ">
              <Input
                type="number"
                value={condition?.rangeFrom ?? ''}
                onChange={(event) => patchCondition({ rangeFrom: event.target.value })}
                placeholder="Giá trị bắt đầu"
              />
            </FieldLabel>

            <FieldLabel label="Đến">
              <Input
                type="number"
                value={condition?.rangeTo ?? ''}
                onChange={(event) => patchCondition({ rangeTo: event.target.value })}
                placeholder="Giá trị kết thúc"
              />
            </FieldLabel>
          </>
        )}

        {activeOperator !== 'all' && activeOperator !== 'range' && activeOperator !== 'lien_tiep' && (
          <FieldLabel label="Giá trị">
            <Input
              type="number"
              value={condition?.value ?? ''}
              onChange={(event) => patchCondition({ value: event.target.value })}
              placeholder="Nhập giá trị"
            />
          </FieldLabel>
        )}
      </div>

      {activeOperator === 'all' && (
        <p className="mt-3 text-xs text-slate-500">
          Operator "Tất cả" giữ lại chỉ tiêu trên card nhưng không tạo điều kiện lọc.
        </p>
      )}

      {activeOperator === 'lien_tiep' && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FieldLabel label="So sánh ngưỡng">
              <Select
                options={TIME_SERIES_COMPARATOR_OPTIONS}
                value={timeSeries.comparator || '>'}
                onChange={(event) => patchTimeSeries({ comparator: event.target.value })}
              />
            </FieldLabel>

            <FieldLabel label="Ngưỡng (%)">
              <Input
                type="number"
                value={timeSeries.threshold ?? ''}
                onChange={(event) => patchTimeSeries({ threshold: event.target.value })}
                placeholder="Ví dụ: 20"
              />
            </FieldLabel>

            <FieldLabel label="Số kỳ liên tiếp">
              <Input
                type="number"
                min="1"
                value={timeSeries.periods ?? '3'}
                onChange={(event) => patchTimeSeries({ periods: event.target.value })}
                placeholder="Ví dụ: 3"
              />
            </FieldLabel>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FieldLabel label="Đơn vị kỳ">
              <Select
                options={PERIOD_TYPE_OPTIONS}
                value={periodType}
                onChange={(event) => patchTimeSeries({ periodType: event.target.value })}
              />
            </FieldLabel>

            <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-200/85">
              Ví dụ CANSLIM/SEPA: tăng trưởng &gt; 20% trong 3 quý liên tiếp.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldLabel({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-slate-500">{label}</p>
      {children}
    </div>
  )
}
