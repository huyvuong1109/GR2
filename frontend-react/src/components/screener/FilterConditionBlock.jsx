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

  // Tat ca dropdown va input trong card nay deu bind theo metric.id.
  // Moi lan thay doi se day patch len parent de cap nhat dung filter item.
  const patchCondition = (patch) => {
    onChange(metric.id, patch)
  }

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
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{metric.label}</p>
          {metric.description && (
            <p className="mt-1 text-xs text-gray-400">{metric.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" size="sm">
            {activeOperator === 'lien_tiep' ? PERIOD_UNIT_LABEL[periodType] : metric.unit}
          </Badge>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-gray-400 hover:text-red-300"
            onClick={() => onRemove(metric.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <p className="mb-1 text-xs text-gray-400">Phép so sánh</p>
          <Select
            options={DYNAMIC_OPERATOR_OPTIONS}
            value={activeOperator}
            onChange={(event) => patchCondition({ operator: event.target.value })}
          />
        </div>

        {activeOperator === 'range' && (
          <>
            <div>
              <p className="mb-1 text-xs text-gray-400">Từ</p>
              <Input
                type="number"
                value={condition?.rangeFrom ?? ''}
                onChange={(event) => patchCondition({ rangeFrom: event.target.value })}
                placeholder="Giá trị bắt đầu"
                className="bg-white/5 border-white/20"
              />
            </div>

            <div>
              <p className="mb-1 text-xs text-gray-400">Đến</p>
              <Input
                type="number"
                value={condition?.rangeTo ?? ''}
                onChange={(event) => patchCondition({ rangeTo: event.target.value })}
                placeholder="Giá trị kết thúc"
                className="bg-white/5 border-white/20"
              />
            </div>
          </>
        )}

        {activeOperator !== 'all' && activeOperator !== 'range' && activeOperator !== 'lien_tiep' && (
          <div>
            <p className="mb-1 text-xs text-gray-400">Giá trị</p>
            <Input
              type="number"
              value={condition?.value ?? ''}
              onChange={(event) => patchCondition({ value: event.target.value })}
              placeholder="Nhập giá trị"
              className="bg-white/5 border-white/20"
            />
          </div>
        )}
      </div>

      {activeOperator === 'all' && (
        <p className="mt-3 text-xs text-gray-500">
          Operator "Tất cả" giữ lại chỉ tiêu trên card nhưng không tạo điều kiện lọc.
        </p>
      )}

      {activeOperator === 'lien_tiep' && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <p className="mb-1 text-xs text-gray-400">So sánh ngưỡng</p>
              <Select
                options={TIME_SERIES_COMPARATOR_OPTIONS}
                value={timeSeries.comparator || '>'}
                onChange={(event) => patchTimeSeries({ comparator: event.target.value })}
              />
            </div>

            <div>
              <p className="mb-1 text-xs text-gray-400">Ngưỡng (%)</p>
              <Input
                type="number"
                value={timeSeries.threshold ?? ''}
                onChange={(event) => patchTimeSeries({ threshold: event.target.value })}
                placeholder="Ví dụ: 20"
                className="bg-white/5 border-white/20"
              />
            </div>

            <div>
              <p className="mb-1 text-xs text-gray-400">Số kỳ liên tiếp</p>
              <Input
                type="number"
                min="1"
                value={timeSeries.periods ?? '3'}
                onChange={(event) => patchTimeSeries({ periods: event.target.value })}
                placeholder="Ví dụ: 3"
                className="bg-white/5 border-white/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-gray-400">Đơn vị kỳ</p>
              <Select
                options={PERIOD_TYPE_OPTIONS}
                value={periodType}
                onChange={(event) => patchTimeSeries({ periodType: event.target.value })}
              />
            </div>

            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200">
              Ví dụ CANSLIM/SEPA: Tăng trưởng &gt; 20% trong 3 quý liên tiếp.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
