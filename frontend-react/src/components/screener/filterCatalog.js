export const DYNAMIC_OPERATOR_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'gt', label: 'Lớn hơn' },
  { value: 'lt', label: 'Nhỏ hơn' },
  { value: 'eq', label: 'Bằng' },
  { value: 'range', label: 'Khoảng' },
  { value: 'lien_tiep', label: 'Liên tiếp' },
]

export const TIME_SERIES_COMPARATOR_OPTIONS = [
  { value: '>', label: 'Lớn hơn' },
  { value: '<', label: 'Nhỏ hơn' },
  { value: '=', label: 'Bằng' },
]

export const PERIOD_TYPE_OPTIONS = [
  { value: 'quarter', label: 'Quý' },
  { value: 'year', label: 'Năm' },
]

export const FILTER_GROUPS = [
  {
    id: 'by_index',
    label: 'Theo chỉ số',
    description: 'Lọc theo các metric tài chính cụ thể như ROE, P/E, biên lợi nhuận.',
    children: [
      {
        id: 'index_market',
        label: 'Chỉ số thị trường',
        children: [
          {
            id: 'pe_ratio',
            label: 'P/E',
            unit: 'lần',
            description: 'Chỉ số giá trên thu nhập',
            apiMinKey: 'min_pe',
            apiMaxKey: 'max_pe',
          },
          {
            id: 'pb_ratio',
            label: 'P/B',
            unit: 'lần',
            description: 'Chỉ số giá trên giá trị sổ sách',
            apiMinKey: 'min_pb',
            apiMaxKey: 'max_pb',
          },
          {
            id: 'market_cap',
            label: 'Vốn hóa thị trường',
            unit: 'Tỷ VNĐ',
            description: 'Quy mô doanh nghiệp',
          },
        ],
      },
      {
        id: 'index_profitability',
        label: 'Hiệu quả kinh doanh',
        children: [
          {
            id: 'roe',
            label: 'ROE',
            unit: '%',
            description: 'Hiệu quả sử dụng vốn chủ sở hữu',
            apiMinKey: 'min_roe',
            apiMaxKey: 'max_roe',
            supportsTimeSeries: true,
            defaultPeriodType: 'year',
          },
          {
            id: 'roa',
            label: 'ROA',
            unit: '%',
            description: 'Hiệu quả sử dụng tổng tài sản',
            apiMinKey: 'min_roa',
          },
          {
            id: 'gross_margin',
            label: 'Biên lợi nhuận gộp',
            unit: '%',
            description: 'Lợi nhuận gộp trên doanh thu',
            apiMinKey: 'min_gross_margin',
          },
          {
            id: 'net_margin',
            label: 'Biên lợi nhuận ròng',
            unit: '%',
            description: 'Lợi nhuận ròng trên doanh thu',
            apiMinKey: 'min_net_margin',
          },
        ],
      },
      {
        id: 'index_health',
        label: 'Sức khỏe tài chính',
        children: [
          {
            id: 'debt_to_equity',
            label: 'Nợ/Vốn chủ sở hữu (D/E)',
            unit: 'lần',
            description: 'Mức độ đòn bẩy tài chính',
            apiMaxKey: 'max_de',
          },
          {
            id: 'current_ratio',
            label: 'Current Ratio',
            unit: 'lần',
            description: 'Khả năng thanh toán ngắn hạn',
            apiMinKey: 'min_current_ratio',
          },
          {
            id: 'f_score',
            label: 'Piotroski F-Score',
            unit: 'điểm',
            description: 'Đánh giá sức khỏe tài chính tổng hợp',
            apiMinKey: 'min_f_score',
          },
        ],
      },
      {
        id: 'index_growth',
        label: 'Tăng trưởng',
        children: [
          {
            id: 'revenue_growth',
            label: 'Tăng trưởng doanh thu',
            unit: '%',
            description: 'Tăng trưởng doanh thu theo kỳ',
            apiMinKey: 'min_revenue_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
          },
          {
            id: 'profit_growth',
            label: 'Tăng trưởng lợi nhuận',
            unit: '%',
            description: 'Tăng trưởng lợi nhuận theo kỳ',
            apiMinKey: 'min_profit_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
          },
        ],
      },
    ],
  },
  {
    id: 'by_method',
    label: 'Theo phương pháp',
    description: 'Lọc theo bộ quy tắc của từng trường phái đầu tư như CANSLIM, GARP, Value.',
    children: [
      {
        id: 'method_value',
        label: 'Value Investing',
        children: [
          {
            id: 'value_pe',
            label: 'P/E thấp',
            unit: 'lần',
            description: 'Cổ phiếu rẻ theo thu nhập',
            apiMaxKey: 'max_pe',
          },
          {
            id: 'value_pb',
            label: 'P/B thấp',
            unit: 'lần',
            description: 'Mức giá thấp theo giá trị sổ sách',
            apiMaxKey: 'max_pb',
          },
          {
            id: 'value_roe',
            label: 'ROE đạt ngưỡng chất lượng',
            unit: '%',
            description: 'Kết hợp giá rẻ và chất lượng',
            apiMinKey: 'min_roe',
          },
        ],
      },
      {
        id: 'method_canslim',
        label: 'CANSLIM',
        children: [
          {
            id: 'canslim_revenue_growth',
            label: 'Tăng trưởng doanh thu',
            unit: '%',
            description: 'Doanh thu tăng mạnh theo quý',
            apiMinKey: 'min_revenue_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
          },
          {
            id: 'canslim_profit_growth',
            label: 'Tăng trưởng lợi nhuận',
            unit: '%',
            description: 'Lợi nhuận tăng mạnh theo quý',
            apiMinKey: 'min_profit_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
          },
          {
            id: 'canslim_roe',
            label: 'ROE cao',
            unit: '%',
            description: 'Năng lực sinh lời bền vững',
            apiMinKey: 'min_roe',
          },
        ],
      },
      {
        id: 'method_garp',
        label: 'GARP',
        children: [
          {
            id: 'garp_pe',
            label: 'P/E hợp lý',
            unit: 'lần',
            description: 'Không mua quá đắt',
            apiMaxKey: 'max_pe',
          },
          {
            id: 'garp_profit_growth',
            label: 'Tăng trưởng lợi nhuận ổn',
            unit: '%',
            description: 'Tăng trưởng duy trì theo quý',
            apiMinKey: 'min_profit_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
          },
          {
            id: 'garp_roe',
            label: 'ROE tối thiểu',
            unit: '%',
            description: 'Hiệu quả sử dụng vốn đạt ngưỡng',
            apiMinKey: 'min_roe',
          },
        ],
      },
      {
        id: 'method_quality',
        label: 'Quality Compounder',
        children: [
          {
            id: 'quality_fscore',
            label: 'F-Score cao',
            unit: 'điểm',
            description: 'Sức khỏe tài chính tổng hợp',
            apiMinKey: 'min_f_score',
          },
          {
            id: 'quality_roe',
            label: 'ROE cao và ổn định',
            unit: '%',
            description: 'Hiệu quả bổ sung cho F-Score',
            apiMinKey: 'min_roe',
          },
          {
            id: 'quality_de',
            label: 'Đòn bẩy thấp',
            unit: 'lần',
            description: 'Nợ vay trong ngưỡng an toàn',
            apiMaxKey: 'max_de',
          },
          {
            id: 'quality_current_ratio',
            label: 'Thanh khoản ngắn hạn tốt',
            unit: 'lần',
            description: 'Current ratio trên ngưỡng',
            apiMinKey: 'min_current_ratio',
          },
        ],
      },
    ],
  },
]

export const METRIC_TREE = FILTER_GROUPS

function flattenMetrics(tree, collector = []) {
  tree.forEach((node) => {
    if (node.children?.length) {
      flattenMetrics(node.children, collector)
      return
    }

    collector.push(node)
  })

  return collector
}

export const FLAT_METRICS = flattenMetrics(METRIC_TREE)

export const METRIC_BY_ID = FLAT_METRICS.reduce((acc, metric) => {
  acc[metric.id] = metric
  return acc
}, {})