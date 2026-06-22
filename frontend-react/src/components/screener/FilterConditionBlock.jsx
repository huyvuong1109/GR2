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

const METRIC_GUIDES = {
  pe_ratio: {
    purpose: 'P/E cho biết nhà đầu tư đang trả bao nhiêu đồng cho 1 đồng lợi nhuận. Dùng để tránh mua cổ phiếu quá đắt so với khả năng kiếm tiền.',
    good: 'Thường dễ chịu khi P/E khoảng 8-15 lần, nhưng nên so với trung bình ngành.',
    weak: 'P/E quá cao có thể là kỳ vọng tăng trưởng lớn hoặc giá đã đắt; P/E âm/không có dữ liệu thường do doanh nghiệp lỗ.',
    example: 'Ví dụ: lọc P/E nhỏ hơn 15 để tìm các mã chưa bị định giá quá cao.',
  },
  pb_ratio: {
    purpose: 'P/B so sánh giá thị trường với giá trị sổ sách. Hữu ích với ngân hàng, bảo hiểm, bất động sản và doanh nghiệp nhiều tài sản.',
    good: 'P/B quanh 1-2 lần thường hợp lý hơn nếu doanh nghiệp vẫn có ROE tốt.',
    weak: 'P/B rất cao dễ phản ánh kỳ vọng lớn; P/B thấp nhưng ROE yếu có thể là bẫy giá rẻ.',
    example: 'Ví dụ: lọc P/B nhỏ hơn 1.5 rồi kết hợp ROE lớn hơn 12%.',
  },
  market_cap: {
    purpose: 'Vốn hóa cho biết quy mô doanh nghiệp trên thị trường. Dùng để lọc nhóm vốn hóa lớn, vừa hoặc nhỏ.',
    good: 'Vốn hóa lớn thường ổn định hơn; vốn hóa nhỏ có thể tăng nhanh nhưng rủi ro biến động cao hơn.',
    weak: 'Không nên xem vốn hóa là tốt/xấu độc lập, cần kết hợp thanh khoản và chất lượng kinh doanh.',
    example: 'Ví dụ: lọc vốn hóa lớn hơn 5.000 tỷ để tránh các mã quá nhỏ.',
  },
  roe: {
    purpose: 'ROE đo hiệu quả tạo lợi nhuận trên vốn chủ sở hữu. Đây là chỉ số chất lượng quan trọng.',
    good: 'ROE trên 15% thường tốt nếu duy trì nhiều năm và không đến từ vay nợ quá cao.',
    weak: 'ROE thấp kéo dài cho thấy vốn sử dụng kém hiệu quả; ROE cao bất thường cần kiểm tra nợ vay và lợi nhuận đột biến.',
    example: 'Ví dụ: lọc ROE lớn hơn 15% để tìm doanh nghiệp sinh lời tốt.',
  },
  roa: {
    purpose: 'ROA đo lợi nhuận tạo ra trên tổng tài sản. Chỉ số này giúp nhìn hiệu quả vận hành tổng thể.',
    good: 'ROA trên 5-8% thường là tín hiệu tốt với nhiều ngành sản xuất/dịch vụ.',
    weak: 'ROA thấp cho thấy tài sản tạo lợi nhuận kém; riêng ngân hàng cần so sánh theo chuẩn ngành.',
    example: 'Ví dụ: lọc ROA lớn hơn 5% để tránh doanh nghiệp dùng nhiều tài sản nhưng sinh lời thấp.',
  },
  gross_margin: {
    purpose: 'Biên lợi nhuận gộp cho biết doanh nghiệp giữ lại bao nhiêu lợi nhuận sau giá vốn.',
    good: 'Biên gộp cao và ổn định cho thấy lợi thế cạnh tranh hoặc khả năng định giá tốt.',
    weak: 'Biên gộp giảm liên tục có thể báo hiệu cạnh tranh, giá nguyên liệu tăng hoặc sức mua yếu.',
    example: 'Ví dụ: lọc biên lợi nhuận gộp lớn hơn 20% để tìm doanh nghiệp có dư địa lợi nhuận tốt.',
  },
  net_margin: {
    purpose: 'Biên lợi nhuận ròng cho biết sau mọi chi phí, doanh nghiệp giữ lại bao nhiêu lợi nhuận trên doanh thu.',
    good: 'Biên ròng càng cao càng tốt nếu không đến từ thu nhập bất thường.',
    weak: 'Biên ròng thấp dễ bị ảnh hưởng khi chi phí tăng hoặc doanh thu giảm.',
    example: 'Ví dụ: lọc biên lợi nhuận ròng lớn hơn 8% để tìm doanh nghiệp kiểm soát chi phí tốt.',
  },
  debt_to_equity: {
    purpose: 'D/E đo mức nợ so với vốn chủ. Dùng để kiểm soát rủi ro đòn bẩy tài chính.',
    good: 'D/E dưới 1 lần thường an toàn hơn với nhiều ngành phi tài chính.',
    weak: 'D/E cao hơn 2 lần là rủi ro đáng chú ý, đặc biệt khi lãi suất tăng hoặc dòng tiền yếu.',
    example: 'Ví dụ: lọc D/E nhỏ hơn 1 để ưu tiên doanh nghiệp ít vay nợ.',
  },
  current_ratio: {
    purpose: 'Current Ratio đo khả năng dùng tài sản ngắn hạn để trả nợ ngắn hạn.',
    good: 'Trên 1.2 lần thường dễ thở hơn; trên 1.5 lần là khá tốt với nhiều ngành.',
    weak: 'Dưới 1 lần nghĩa là tài sản ngắn hạn không đủ phủ nợ ngắn hạn, cần kiểm tra dòng tiền.',
    example: 'Ví dụ: lọc Current Ratio lớn hơn 1.2 để giảm rủi ro thanh khoản.',
  },
  f_score: {
    purpose: 'Piotroski F-Score chấm sức khỏe tài chính từ 0-9 dựa trên lợi nhuận, dòng tiền, đòn bẩy và hiệu quả hoạt động.',
    good: 'F-Score 7-9 thường là nhóm khỏe; 5-6 là trung bình.',
    weak: 'F-Score dưới 4 cho thấy nhiều tín hiệu yếu, cần thận trọng.',
    example: 'Ví dụ: lọc F-Score lớn hơn hoặc bằng 7 để tìm doanh nghiệp nền tảng tốt.',
  },
  revenue_growth: {
    purpose: 'Tăng trưởng doanh thu cho biết quy mô bán hàng có mở rộng hay không.',
    good: 'Tăng trưởng trên 10-20% là tích cực nếu đi kèm lợi nhuận và dòng tiền.',
    weak: 'Doanh thu giảm nhiều kỳ liên tiếp có thể cho thấy nhu cầu yếu hoặc mất thị phần.',
    example: 'Ví dụ: lọc tăng trưởng doanh thu lớn hơn 15% để tìm doanh nghiệp đang mở rộng.',
  },
  profit_growth: {
    purpose: 'Tăng trưởng lợi nhuận cho biết phần lợi ích cuối cùng của cổ đông có tăng lên hay không.',
    good: 'Tăng trưởng lợi nhuận trên 15-20% là tích cực nếu không đến từ khoản bất thường.',
    weak: 'Lợi nhuận giảm trong khi doanh thu tăng có thể cho thấy biên lợi nhuận bị thu hẹp.',
    example: 'Ví dụ: lọc tăng trưởng lợi nhuận lớn hơn 20% trong 3 quý liên tiếp.',
  },
  eps_growth: {
    purpose: 'Tăng trưởng EPS (Lợi nhuận trên mỗi cổ phiếu) đánh giá lợi ích thực sự cổ đông nhận được. Đây là chìa khóa của các siêu cổ phiếu.',
    good: 'Theo SEPA, EPS tăng trưởng YoY > 40% là dấu hiệu của siêu cổ phiếu bước vào giai đoạn bứt tốc.',
    weak: 'EPS giảm hoặc pha loãng do phát hành thêm cổ phiếu quá nhiều dù tổng lợi nhuận có tăng.',
    example: 'Ví dụ: lọc EPS tăng YoY lớn hơn 40%.',
  },
  gross_margin_growth: {
    purpose: 'Biên lãi gộp tăng trưởng cho thấy doanh nghiệp đang bán được hàng giá cao hơn hoặc tối ưu được chi phí sản xuất.',
    good: 'Biên gộp cải thiện so với cùng kỳ năm trước cho thấy lợi thế cạnh tranh cốt lõi đang mạnh lên.',
    weak: 'Biên gộp giảm dù doanh thu tăng là dấu hiệu phải hạ giá bán để cạnh tranh.',
    example: 'Ví dụ: lọc biên lãi gộp tăng trưởng lớn hơn 0.',
  },
}

const METHOD_METRIC_MAP = {
  value_pe: 'pe_ratio',
  garp_pe: 'pe_ratio',
  value_pb: 'pb_ratio',
  value_roe: 'roe',
  canslim_roe: 'roe',
  garp_roe: 'roe',
  quality_roe: 'roe',
  quality_de: 'debt_to_equity',
  quality_current_ratio: 'current_ratio',
  quality_fscore: 'f_score',
  canslim_revenue_growth: 'revenue_growth',
  canslim_profit_growth: 'profit_growth',
  sepa_revenue_growth: 'revenue_growth',
  sepa_profit_growth: 'profit_growth',
  sepa_eps_growth: 'eps_growth',
  sepa_gross_margin_growth: 'gross_margin_growth',
}

const guideForMetric = (metricId) => METRIC_GUIDES[METHOD_METRIC_MAP[metricId] || metricId]

export default function FilterConditionBlock({ metric, condition, onChange, onRemove }) {
  const activeOperator = condition?.operator || 'all'
  const timeSeries = condition?.timeSeries || {}
  const guide = guideForMetric(metric.id)

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
                className="h-10 px-3 text-sm font-semibold"
              />
            </FieldLabel>

            <FieldLabel label="Đến">
              <Input
                type="number"
                value={condition?.rangeTo ?? ''}
                onChange={(event) => patchCondition({ rangeTo: event.target.value })}
                placeholder="Giá trị kết thúc"
                className="h-10 px-3 text-sm font-semibold"
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
            className="h-10 px-3 text-sm font-semibold"
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
                className="h-10 px-3 text-sm font-semibold"
              />
            </FieldLabel>

            <FieldLabel label="Số kỳ liên tiếp">
              <Input
                type="number"
                min="1"
                value={timeSeries.periods ?? '3'}
                onChange={(event) => patchTimeSeries({ periods: event.target.value })}
                placeholder="Ví dụ: 3"
                className="h-10 px-3 text-sm font-semibold"
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

      {guide && (
        <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-400/[0.07] p-3 text-xs leading-5 text-slate-300">
          <p className="font-black text-emerald-300">Cách hiểu chỉ số này</p>
          <p className="mt-1">{guide.purpose}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-black/15 p-2">
              <p className="font-bold text-emerald-200">Tín hiệu tốt</p>
              <p className="mt-1 text-slate-400">{guide.good}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/15 p-2">
              <p className="font-bold text-red-200">Cần thận trọng</p>
              <p className="mt-1 text-slate-400">{guide.weak}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/15 p-2">
              <p className="font-bold text-slate-200">Ví dụ lọc</p>
              <p className="mt-1 text-slate-400">{guide.example}</p>
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
