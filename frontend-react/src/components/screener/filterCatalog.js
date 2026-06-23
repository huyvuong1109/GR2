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

export const METHOD_PRESETS = {
  method_canslim: {
    title: 'CANSLIM nguyên mẫu',
    summary:
      'Bản mẫu dùng dữ liệu hiện có: tăng trưởng doanh thu và lợi nhuận quý hiện tại so với cùng quý năm trước, cộng thêm ngưỡng ROE tối thiểu. Các chữ N, S, L, I, M cần dữ liệu giá, thanh khoản và sở hữu tổ chức nên được ghi chú theo lý thuyết thay vì tự động lọc bằng báo cáo tài chính.',
    rules: [
      'C - Doanh thu quý tăng tối thiểu 25%',
      'C - Lợi nhuận quý tăng tối thiểu 25%',
      'A - ROE tối thiểu 17%',
    ],
  },
  method_value: {
    title: 'Value Investing mẫu',
    summary: 'Tìm doanh nghiệp có định giá thấp nhưng vẫn đạt ngưỡng sinh lời cơ bản.',
    rules: ['P/E nhỏ hơn 15', 'P/B nhỏ hơn 1.5', 'ROE lớn hơn 15%'],
  },
  method_sepa: {
    title: 'SEPA (Tăng trưởng)',
    summary: 'Lọc cổ phiếu siêu hạng theo Mark Minervini: tập trung vào tăng trưởng đột biến (Doanh thu, LNST, EPS) và biên lãi gộp cải thiện so với cùng kỳ năm trước (YoY) để loại bỏ tính mùa vụ.',
    rules: ['Doanh thu tăng YoY >= 15%', 'Biên lãi gộp tăng YoY > 0%', 'LNST tăng YoY > 0%', 'EPS tăng YoY >= 40%'],
  },
  method_quality: {
    title: 'Quality Compounder mẫu',
    summary: 'Ưu tiên doanh nghiệp có sức khỏe tài chính tốt, sinh lời ổn định và đòn bẩy trong ngưỡng kiểm soát.',
    rules: ['F-Score tối thiểu 7', 'ROE lớn hơn 15%', 'D/E nhỏ hơn 1', 'Current Ratio lớn hơn 1.2'],
  },
}

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
            defaultCondition: { operator: 'lt', value: '15' },
          },
          {
            id: 'pb_ratio',
            label: 'P/B',
            unit: 'lần',
            description: 'Chỉ số giá trên giá trị sổ sách',
            apiMinKey: 'min_pb',
            apiMaxKey: 'max_pb',
            defaultCondition: { operator: 'lt', value: '1.5' },
          },
          {
            id: 'market_cap',
            label: 'Vốn hóa thị trường',
            unit: 'Tỷ VND',
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
            defaultCondition: { operator: 'gt', value: '15' },
          },
          {
            id: 'roa',
            label: 'ROA',
            unit: '%',
            description: 'Hiệu quả sử dụng tổng tài sản',
            apiMinKey: 'min_roa',
            defaultCondition: { operator: 'gt', value: '5' },
          },
          {
            id: 'gross_margin',
            label: 'Biên lợi nhuận gộp',
            unit: '%',
            description: 'Lợi nhuận gộp trên doanh thu',
            apiMinKey: 'min_gross_margin',
            defaultCondition: { operator: 'gt', value: '20' },
          },
          {
            id: 'net_margin',
            label: 'Biên lợi nhuận ròng',
            unit: '%',
            description: 'Lợi nhuận ròng trên doanh thu',
            apiMinKey: 'min_net_margin',
            defaultCondition: { operator: 'gt', value: '8' },
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
            defaultCondition: { operator: 'lt', value: '1' },
          },
          {
            id: 'current_ratio',
            label: 'Current Ratio',
            unit: 'lần',
            description: 'Khả năng thanh toán ngắn hạn',
            apiMinKey: 'min_current_ratio',
            defaultCondition: { operator: 'gt', value: '1.2' },
          },
          {
            id: 'f_score',
            label: 'Piotroski F-Score',
            unit: 'điểm',
            description: 'Đánh giá sức khỏe tài chính tổng hợp',
            apiMinKey: 'min_f_score',
            defaultCondition: { operator: 'gt', value: '6' },
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
            defaultCondition: { operator: 'gt', value: '15' },
          },
          {
            id: 'profit_growth',
            label: 'Tăng trưởng lợi nhuận',
            unit: '%',
            description: 'Tăng trưởng lợi nhuận theo kỳ',
            apiMinKey: 'min_profit_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
            defaultCondition: { operator: 'gt', value: '20' },
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
            defaultCondition: { operator: 'lt', value: '15' },
          },
          {
            id: 'value_pb',
            label: 'P/B thấp',
            unit: 'lần',
            description: 'Mức giá thấp theo giá trị sổ sách',
            apiMaxKey: 'max_pb',
            defaultCondition: { operator: 'lt', value: '1.5' },
          },
          {
            id: 'value_roe',
            label: 'ROE đạt ngưỡng chất lượng',
            unit: '%',
            description: 'Kết hợp giá rẻ và chất lượng',
            apiMinKey: 'min_roe',
            defaultCondition: { operator: 'gt', value: '15' },
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
            defaultCondition: { operator: 'gt', value: '25' },
          },
          {
            id: 'canslim_profit_growth',
            label: 'Tăng trưởng lợi nhuận',
            unit: '%',
            description: 'Lợi nhuận tăng mạnh theo quý',
            apiMinKey: 'min_profit_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
            defaultCondition: { operator: 'gt', value: '25' },
          },
          {
            id: 'canslim_roe',
            label: 'ROE cao',
            unit: '%',
            description: 'Năng lực sinh lời bền vững',
            apiMinKey: 'min_roe',
            defaultCondition: { operator: 'gt', value: '17' },
          },
        ],
      },
      {
        id: 'method_sepa',
        label: 'SEPA (Tăng trưởng)',
        children: [
          {
            id: 'sepa_revenue_growth',
            label: 'Tăng trưởng doanh thu',
            unit: '%',
            description: 'Tăng trưởng doanh thu YoY tối thiểu 15%',
            apiMinKey: 'min_revenue_growth',
            supportsTimeSeries: true,
            defaultPeriodType: 'quarter',
            defaultCondition: { operator: 'gt', value: '15' },
          },
          {
            id: 'sepa_gross_margin_growth',
            label: 'Biên lãi gộp tăng trưởng',
            unit: '%',
            description: 'Biên lãi gộp tăng so với cùng kỳ',
            apiMinKey: 'min_gross_margin_growth',
            defaultCondition: { operator: 'gt', value: '0' },
          },
          {
            id: 'sepa_stable_gross_margin',
            label: 'BLG duy trì ổn định',
            unit: '',
            description: 'Biên lãi gộp quý này >= Trung bình BLG 3 quý gần nhất',
            apiMinKey: 'min_gross_margin_vs_3q_avg',
            defaultCondition: { operator: 'gt', value: '0' },
          },
          {
            id: 'sepa_profit_growth',
            label: 'Tăng trưởng LNST',
            unit: '%',
            description: 'Tăng trưởng lợi nhuận YoY dương',
            apiMinKey: 'min_profit_growth',
            defaultCondition: { operator: 'gt', value: '0' },
          },
          {
            id: 'sepa_eps_growth',
            label: 'Tăng trưởng EPS',
            unit: '%',
            description: 'Tăng trưởng EPS YoY tối thiểu 40%',
            apiMinKey: 'min_eps_growth',
            defaultCondition: { operator: 'gt', value: '40' },
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
            defaultCondition: { operator: 'gt', value: '6' },
          },
          {
            id: 'quality_roe',
            label: 'ROE cao và ổn định',
            unit: '%',
            description: 'Hiệu quả bổ sung cho F-Score',
            apiMinKey: 'min_roe',
            defaultCondition: { operator: 'gt', value: '15' },
          },
          {
            id: 'quality_de',
            label: 'Đòn bẩy thấp',
            unit: 'lần',
            description: 'Nợ vay trong ngưỡng an toàn',
            apiMaxKey: 'max_de',
            defaultCondition: { operator: 'lt', value: '1' },
          },
          {
            id: 'quality_current_ratio',
            label: 'Thanh khoản ngắn hạn tốt',
            unit: 'lần',
            description: 'Current ratio trên ngưỡng',
            apiMinKey: 'min_current_ratio',
            defaultCondition: { operator: 'gt', value: '1.2' },
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
